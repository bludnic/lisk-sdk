/*
 * Copyright © 2019 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

import * as axon from 'pm2-axon';
import {
	PubEmitterSocket,
	RepSocket,
	ReqSocket,
	SubEmitterSocket,
} from 'pm2-axon';
import { Client as RPCClient, Server as RPCServer } from 'pm2-axon-rpc';
import { EventEmitter2, Listener } from 'eventemitter2';
import { Action, ActionInfoObject, ActionsObject } from './action';
import { Logger } from '../application/logger';
import { BaseChannel } from './channels/base_channel';
import { EventsArray } from './event';
import { SocketPaths } from './types';
import { SOCKET_TIMEOUT_TIME } from './constants';

interface BusConfiguration {
	ipc: {
		readonly enabled: boolean;
	};
	socketsPath: SocketPaths;
}

interface RegisterChannelOptions {
	readonly type: string;
	readonly channel: BaseChannel;
	readonly rpcSocketPath?: string;
}

type NodeCallback = (error: Error | null, result?: unknown) => void;

interface ChannelInfo {
	readonly channel: BaseChannel;
	readonly actions: ActionsObject;
	readonly events: EventsArray;
	readonly type: string;
}

export class Bus extends EventEmitter2 {
	public logger: Logger;

	private readonly config: BusConfiguration;
	private readonly actions: { [key: string]: Action };
	private readonly events: { [key: string]: boolean };
	private readonly channels: {
		[key: string]: ChannelInfo;
	};
	private readonly rpcClients: { [key: string]: ReqSocket };
	private pubSocket?: PubEmitterSocket;
	private subSocket?: SubEmitterSocket;
	private rpcSocket?: RepSocket;
	private rpcServer?: RPCServer;

	public constructor(
		options: object,
		logger: Logger,
		config: BusConfiguration,
	) {
		super(options);
		this.logger = logger;
		this.config = config;

		// Hash map used instead of arrays for performance.
		this.actions = {};
		this.events = {};
		this.channels = {};
		this.rpcClients = {};
	}

	public async setup(): Promise<boolean> {
		if (!this.config.ipc.enabled) {
			return true;
		}

		this.pubSocket = axon.socket('pub-emitter') as PubEmitterSocket;
		this.pubSocket.bind(this.config.socketsPath.pub);

		this.subSocket = axon.socket('sub-emitter') as SubEmitterSocket;
		this.subSocket.bind(this.config.socketsPath.sub);

		this.rpcSocket = axon.socket('rep') as RepSocket;
		this.rpcServer = new RPCServer(this.rpcSocket);
		this.rpcSocket.bind(this.config.socketsPath.rpc);

		this.rpcServer.expose(
			'registerChannel',
			(moduleAlias, events, actions, options, cb: NodeCallback) => {
				this.registerChannel(moduleAlias, events, actions, options)
					.then(() => cb(null))
					.catch(error => cb(error));
			},
		);

		this.rpcServer.expose('invoke', (action, cb: NodeCallback) => {
			this.invoke(action)
				.then(data => cb(null, data))
				.catch(error => cb(error));
		});

		this.rpcServer.expose('invokePublic', (action, cb: NodeCallback) => {
			this.invokePublic(action)
				.then(data => cb(null, data))
				.catch(error => cb(error));
		});

		await Promise.race([
			this._resolveWhenAllSocketsBound(),
			this._rejectWhenAnySocketFailsToBind(),
			this._rejectWhenTimeout(SOCKET_TIMEOUT_TIME),
		]);
		await this._removeAllListeners();

		return true;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async registerChannel(
		moduleAlias: string,
		// Events should also include the module alias
		events: EventsArray,
		actions: ActionsObject,
		options: RegisterChannelOptions,
	): Promise<void> {
		events.forEach(eventName => {
			if (this.events[`${moduleAlias}:${eventName}`] !== undefined) {
				throw new Error(`Event "${eventName}" already registered with bus.`);
			}
			this.events[`${moduleAlias}:${eventName}`] = true;
		});

		Object.keys(actions).forEach(actionName => {
			if (this.actions[`${moduleAlias}:${actionName}`] !== undefined) {
				throw new Error(`Action "${actionName}" already registered with bus.`);
			}

			this.actions[`${moduleAlias}:${actionName}`] = actions[actionName];
		});

		let { channel } = options;

		if (options.rpcSocketPath) {
			const rpcSocket = axon.socket('req') as ReqSocket;
			rpcSocket.connect(options.rpcSocketPath);

			// TODO: Fix this override
			channel = (new RPCClient(rpcSocket) as unknown) as BaseChannel;
			this.rpcClients[moduleAlias] = rpcSocket;
		}

		this.channels[moduleAlias] = {
			channel,
			actions,
			events,
			type: options.type,
		};
	}

	public async invoke<T>(actionData: string | ActionInfoObject): Promise<T> {
		const action = Action.deserialize(actionData);
		const actionFullName = action.key();
		const actionParams = action.params;

		if (this.actions[actionFullName] === undefined) {
			throw new Error(`Action '${action.key()}' is not registered to bus.`);
		}

		const channelInfo = this.channels[action.module];

		return channelInfo.channel.invoke<T>(actionFullName, actionParams);
	}

	public async invokePublic<T>(
		actionData: string | ActionInfoObject,
	): Promise<T> {
		const action = Action.deserialize(actionData);

		// Check if action exists
		if (this.actions[action.key()] === undefined) {
			throw new Error(`Action '${action.key()}' is not registered to bus.`);
		}

		// Check if action is public
		if (!this.actions[action.key()].isPublic) {
			throw new Error(
				`Action '${action.key()}' is not allowed because it's not public.`,
			);
		}

		return this.invoke(actionData);
	}

	public publish(eventName: string, eventValue: object): void {
		if (!this.getEvents().includes(eventName)) {
			throw new Error(`Event ${eventName} is not registered to bus.`);
		}
		// Communicate through event emitter
		this.emit(eventName, eventValue);

		// Communicate through unix socket
		if (this.config.ipc.enabled) {
			this.pubSocket?.emit(eventName, eventValue);
		}
	}

	public subscribe(eventName: string, cb: Listener): void {
		if (!this.getEvents().includes(eventName)) {
			this.logger.info(
				`Event ${eventName} was subscribed but not registered to the bus yet.`,
			);
		}

		// Communicate through event emitter
		this.on(eventName, cb);

		// Communicate through unix socket
		if (this.config.ipc.enabled) {
			this.subSocket?.on(eventName, cb);
		}
	}

	// FIXME: Function signature is different that typescript compains
	// eslint-disable-next-line
	// @ts-ignore
	public once(eventName: string, cb: Listener): void {
		if (!this.getEvents().includes(eventName)) {
			this.logger.info(
				`Event ${eventName} was subscribed but not registered to the bus yet.`,
			);
		}

		// Communicate through event emitter
		super.once(eventName, cb);

		// TODO: make it `once` instead of `on`
		// Communicate through unix socket
		if (this.config.ipc.enabled) {
			this.subSocket?.on(eventName, cb);
		}
	}

	public getActions(): ReadonlyArray<string> {
		return Object.keys(this.actions);
	}

	public getEvents(): ReadonlyArray<string> {
		return Object.keys(this.events);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async cleanup(): Promise<void> {
		if (this.pubSocket) {
			this.pubSocket.close();
		}
		if (this.subSocket) {
			this.subSocket.close();
		}
		if (this.rpcSocket) {
			this.rpcSocket.close();
		}
	}

	private async _resolveWhenAllSocketsBound(): Promise<void> {
		await Promise.all([
			new Promise(resolve => {
				/*
				Here, the reason of calling .sock.once instead of pubSocket.once
				is that pubSocket interface by Axon doesn't expose the once method.
				However the actual socket does, by inheriting it from EventEmitter
				prototype
				 */
				this.subSocket?.sock.once('bind', () => {
					resolve();
				});
			}),
			new Promise(resolve => {
				this.pubSocket?.sock.once('bind', () => {
					resolve();
				});
			}),
			new Promise(resolve => {
				this.rpcSocket?.once('bind', () => {
					resolve();
				});
			}),
		]);
	}

	private async _rejectWhenAnySocketFailsToBind(): Promise<void> {
		await Promise.race([
			new Promise((_, reject) => {
				this.subSocket?.sock.once('error', () => {
					reject();
				});
			}),
			new Promise((_, reject) => {
				this.pubSocket?.sock.once('error', () => {
					reject();
				});
			}),
			new Promise((_, reject) => {
				this.rpcSocket?.once('error', () => {
					reject();
				});
			}),
		]);
	}

	// eslint-disable-next-line class-methods-use-this
	private async _rejectWhenTimeout(timeInMillis: number): Promise<void> {
		return new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error('Bus sockets setup timeout'));
			}, timeInMillis);
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async _removeAllListeners(): Promise<void> {
		this.subSocket?.sock.removeAllListeners('bind');
		this.subSocket?.sock.removeAllListeners('error');
		this.pubSocket?.sock.removeAllListeners('bind');
		this.pubSocket?.sock.removeAllListeners('error');
		this.rpcSocket?.removeAllListeners('bind');
		this.rpcSocket?.removeAllListeners('error');
	}
}