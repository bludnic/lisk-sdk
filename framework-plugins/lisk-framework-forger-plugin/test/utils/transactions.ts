/*
 * Copyright © 2020 Lisk Foundation
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
import { TokenTransferAsset, Transaction, DPoSVoteAsset } from 'lisk-framework';
import { convertLSKToBeddows } from '@liskhq/lisk-transactions';
import { codec } from '@liskhq/lisk-codec';
import { signData } from '@liskhq/lisk-cryptography';
import * as genesisDelegates from '../fixtures/genesis_delegates.json';

export const createTransferTransaction = ({
	amount,
	fee,
	recipientAddress,
	nonce,
	networkIdentifier,
}: {
	amount: string;
	fee: string;
	recipientAddress: string;
	nonce: number;
	networkIdentifier: Buffer;
}) => {
	const genesisAccount = genesisDelegates.accounts[0];
	const encodedAsset = codec.encode(new TokenTransferAsset(BigInt(5000000)).schema, {
		recipientAddress: Buffer.from(recipientAddress, 'base64'),
		amount: BigInt(convertLSKToBeddows(amount)),
		data: '',
	});
	const tx = new Transaction({
		moduleID: 2,
		assetID: 0,
		nonce: BigInt(nonce),
		senderPublicKey: Buffer.from(genesisAccount.publicKey, 'base64'),
		fee: BigInt(convertLSKToBeddows(fee)),
		asset: encodedAsset,
		signatures: [],
	});
	(tx.signatures as Buffer[]).push(
		signData(Buffer.concat([networkIdentifier, tx.getSigningBytes()]), genesisAccount.passphrase),
	);
	return tx;
};

export const createVoteTransaction = ({
	amount,
	fee,
	recipientAddress,
	nonce,
	networkIdentifier,
}: {
	amount: string;
	fee: string;
	recipientAddress: string;
	nonce: number;
	networkIdentifier: Buffer;
}) => {
	const genesisAccount = genesisDelegates.accounts[0];

	const encodedAsset = codec.encode(new DPoSVoteAsset().schema, {
		votes: [
			{
				delegateAddress: Buffer.from(recipientAddress, 'base64'),
				amount: BigInt(convertLSKToBeddows(amount)),
			},
		],
	});

	const tx = new Transaction({
		moduleID: 5,
		assetID: 1,
		nonce: BigInt(nonce),
		senderPublicKey: Buffer.from(genesisAccount.publicKey, 'base64'),
		fee: BigInt(convertLSKToBeddows(fee)),
		asset: encodedAsset,
		signatures: [],
	});
	(tx.signatures as Buffer[]).push(
		signData(Buffer.concat([networkIdentifier, tx.getSigningBytes()]), genesisAccount.passphrase),
	);
	return tx;
};