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
 *
 */
// tslint:disable max-classes-per-file
export class TransactionPoolError extends Error {
	public message: string;
	public id: string;
	public dataPath: string;
	public actual?: string | number;
	public expected?: string | number;
	public constructor(
		message: string = '',
		id: string = '',
		dataPath: string = '',
		actual?: string | number,
		expected?: string | number,
	) {
		super();
		this.message = message;
		this.id = id;
		this.name = 'TransactionPoolError';
		this.dataPath = dataPath;
		this.actual = actual;
		this.expected = expected;
	}

	public toString(): string {
		const defaultMessage = `TransactionPool: ${this.id} failed to process at ${this.dataPath}: ${this.message}`;
		const withActual = this.actual
			? `${defaultMessage}, actual: ${this.actual}`
			: defaultMessage;
		const withExpected = this.expected
			? `${withActual}, expected: ${this.expected}`
			: withActual;

		return withExpected;
	}
}