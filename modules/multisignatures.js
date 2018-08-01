/*
 * Copyright © 2018 Lisk Foundation
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

'use strict';

const async = require('async');
const Multisignature = require('../logic/multisignature.js');
const transactionTypes = require('../helpers/transaction_types.js');
const ApiError = require('../helpers/api_error');
const errorCodes = require('../helpers/api_codes');

let genesisBlock = null; // eslint-disable-line no-unused-vars

// Private fields
let modules;
let library;
let self;
const __private = {};

__private.assetTypes = {};

/**
 * Main multisignatures methods. Initializes library with scope content and generates a Multisignature instance.
 * Calls logic.transaction.attachAssetType().
 *
 * @class
 * @memberof modules
 * @see Parent: {@link modules}
 * @requires async
 * @requires helpers/api_codes
 * @requires helpers/api_error
 * @requires helpers/transaction_types
 * @requires logic/multisignature
 * @param {function} cb - Callback function
 * @param {scope} scope - App instance
 * @returns {setImmediateCallback} cb, null, self
 */
function Multisignatures(cb, scope) {
	library = {
		logger: scope.logger,
		db: scope.db,
		network: scope.network,
		schema: scope.schema,
		ed: scope.ed,
		bus: scope.bus,
		balancesSequence: scope.balancesSequence,
		logic: {
			transaction: scope.logic.transaction,
			account: scope.logic.account,
		},
	};
	genesisBlock = library.genesisBlock;
	self = this;

	__private.assetTypes[
		transactionTypes.MULTI
	] = library.logic.transaction.attachAssetType(
		transactionTypes.MULTI,
		new Multisignature(
			scope.schema,
			scope.network,
			scope.logic.transaction,
			scope.logic.account,
			scope.logger
		)
	);

	setImmediate(cb, null, self);
}

// Public methods

/**
 * Check if the provided signature is valid
 *
 * @private
 * @param {Object} signature - Signature data
 * @param {string} [signature.publicKey] - Public key of account that created the signature (optional)
 * @param {string} signature.transactionId - Id of transaction that signature was created for
 * @param {string} signature.signature - Actual signature
 * @param {Array} members - Array of multisignature account members - public keys
 * @param {Object} transaction - Corresponding transaction grabbed from transaction pool
 * @returns {boolean} isValid - true if signature passed verification, false otherwise
 */
__private.isValidSignature = (signature, members, transaction) => {
	let isValid = false;

	try {
		// If publicKey is provided we can perform direct verify
		if (signature.publicKey) {
			// Check if publicKey is present as member of multisignature account in transaction
			if (!members.includes(signature.publicKey)) {
				library.logger.error(
					'Unable to process signature, signer not in keysgroup.',
					{ signature, members, transaction }
				);
				return isValid;
			}

			// Try to verify the signature
			isValid = library.logic.transaction.verifySignature(
				transaction,
				signature.publicKey,
				signature.signature
			);
		} else {
			// publicKey is not there - we need to iterate through all members of multisignature account in transaction
			isValid = members.find(member =>
				// Try to verify the signature
				library.logic.transaction.verifySignature(
					transaction,
					member,
					signature.signature
				)
			);
		}
	} catch (e) {
		library.logger.error('Unable to process signature, verification failed.', {
			signature,
			members,
			transaction,
			error: e.stack,
		});
	}
	return isValid;
};

/**
 * Process signature for multisignature account creation, transaction type 4 (MULTI)
 *
 * @private
 * @param {Object} signature - Signature data
 * @param {string} [signature.publicKey] - Public key of account that created the signature (optional)
 * @param {string} signature.transactionId - Id of transaction that signature was created for
 * @param {string} signature.signature - Actual signature
 * @param {Object} transaction - Corresponding transaction grabbed from transaction pool
 * @param {function} cb - Callback function
 * @returns {setImmediateCallback} cb, err
 */
__private.processSignatureForMultisignatureCreation = (
	signature,
	transaction,
	cb
) => {
	// Normalize members of multisignature account from transaction
	const members = transaction.asset.multisignature.keysgroup.map(member =>
		member.substring(1) // Remove first character, which is '+'
	);

	// Check if signature is valid
	if (!__private.isValidSignature(signature, members, transaction)) {
		return setImmediate(cb, 'Unable to process signature, verification failed');
	}

	// Add signature to transaction
	transaction.signatures.push(signature.signature);
	// Check if transaction is ready to be processed
	transaction.ready = Multisignature.prototype.ready(
		transaction,
		{} // Pass empty object, as we don't need sender in case of multisignature registration
	);

	// Emit events
	library.network.io.sockets.emit(
		'multisignatures/signature/change',
		transaction
	);
	library.bus.message('signature', signature, true);
	return setImmediate(cb);
};

/**
 * Process signature for transactions that comes from already estabilished multisignature account
 *
 * @private
 * @param {Object} signature - Signature data
 * @param {string} [signature.publicKey] - Public key of account that created the signature (optional)
 * @param {string} signature.transactionId - Id of transaction that signature was created for
 * @param {string} signature.signature - Actual signature
 * @param {Object} transaction - Corresponding transaction grabbed from transaction pool
 * @param {function} cb - Callback function
 * @returns {setImmediateCallback} cb, err
 */
__private.processSignatureFromMultisignatureAccount = (
	signature,
	transaction,
	cb
) => {
	// Get sender account of correscponding transaction
	modules.accounts.getAccount(
		{ address: transaction.senderId },
		(err, sender) => {
			if (err || !sender) {
				const message = 'Unable to process signature, account not found';
				library.logger.error(message, { signature, transaction, error: err });
				return setImmediate(cb, message);
			}

			// Assign members of multisignature account from transaction
			const members = sender.multisignatures;

			// Check if signature is valid
			if (!__private.isValidSignature(signature, members, transaction)) {
				return setImmediate(
					cb,
					'Unable to process signature, verification failed'
				);
			}

			// Add signature to transaction
			transaction.signatures.push(signature.signature);
			// Check if transaction is ready to be processed
			transaction.ready = Multisignature.prototype.ready(transaction, sender);

			// Emit events
			library.network.io.sockets.emit(
				'multisignatures/signature/change',
				transaction
			);
			library.bus.message('signature', signature, true);
			return setImmediate(cb);
		}
	);
};

/**
 * Main function for processing received signature, includes:
 * - multisignature account creation
 * - send from multisignature account
 *
 * @public
 * @param {Object} signature - Signature data
 * @param {string} [signature.publicKey] - Public key of account that created the signature (optional)
 * @param {string} signature.transactionId - Id of transaction that signature was created for
 * @param {string} signature.signature - Actual signature
 * @param {function} cb - Callback function
 * @implements {library.balancesSequence.add} - All processing here is done through balancesSequence
 * @returns {setImmediateCallback} cb, err
 */
Multisignatures.prototype.processSignature = function(signature, cb) {
	if (!signature) {
		const message = 'Unable to process signature, signature not provided';
		library.logger.error(message);
		return setImmediate(cb, message);
	}

	// From now perform all the operations via balanceSequence
	library.balancesSequence.add(balanceSequenceCb => {
		// Grab transaction with corresponding ID from transaction pool
		const transaction = modules.transactions.getMultisignatureTransaction(
			signature.transactionId
		);

		if (!transaction) {
			const message =
				'Unable to process signature, corresponding transaction not found';
			library.logger.error(message, { signature });
			return setImmediate(balanceSequenceCb, message);
		}

		// If there are no signatures yet - initialise with empty array
		transaction.signatures = transaction.signatures || [];

		// Check if received signature already exists in transaction
		if (!transaction.signatures.includes(signature.signature)) {
			const message = 'Unable to process signature, signature already exists';
			library.logger.error(message, { signature, transaction });
			return setImmediate(balanceSequenceCb, message);
		}

		// Process signature for multisignature account creation transaction
		if (transaction.type === transactionTypes.MULTI) {
			return __private.processSignatureForMultisignatureCreation(
				signature,
				transaction,
				balanceSequenceCb
			);
		}

		// Process signature for send from multisignature account transaction
		return __private.processSignatureFromMultisignatureAccount(
			signature,
			transaction,
			balanceSequenceCb
		);
	}, cb);
};

/**
 * Description of getGroup.
 *
 * @todo Add @returns and @param tags
 * @todo Add description for the function
 */
Multisignatures.prototype.getGroup = function(address, cb) {
	const scope = {};

	async.series(
		{
			getAccount(seriesCb) {
				library.logic.account.getMultiSignature({ address }, (err, account) => {
					if (err) {
						return setImmediate(seriesCb, err);
					}

					if (!account) {
						return setImmediate(
							seriesCb,
							new ApiError(
								'Multisignature account not found',
								errorCodes.NOT_FOUND
							)
						);
					}

					scope.group = {
						address: account.address,
						publicKey: account.publicKey,
						secondPublicKey: account.secondPublicKey || '',
						balance: account.balance,
						unconfirmedBalance: account.u_balance,
						min: account.multimin,
						lifetime: account.multilifetime,
						members: [],
					};

					return setImmediate(seriesCb);
				});
			},
			getMembers(seriesCb) {
				library.db.multisignatures
					.getMemberPublicKeys(scope.group.address)
					.then(memberAccountKeys => {
						const addresses = [];

						memberAccountKeys.forEach(key => {
							addresses.push(modules.accounts.generateAddressByPublicKey(key));
						});

						modules.accounts.getAccounts(
							{ address: addresses },
							['address', 'publicKey', 'secondPublicKey'],
							(err, accounts) => {
								accounts.forEach(account => {
									scope.group.members.push({
										address: account.address,
										publicKey: account.publicKey,
										secondPublicKey: account.secondPublicKey || '',
									});
								});

								return setImmediate(seriesCb);
							}
						);
					});
			},
		},
		err => {
			if (err) {
				return setImmediate(cb, err);
			}
			return setImmediate(cb, null, scope.group);
		}
	);
};

// Events
/**
 * Calls Multisignature.bind() with modules params.
 *
 * @param {modules} scope - Loaded modules
 */
Multisignatures.prototype.onBind = function(scope) {
	modules = {
		accounts: scope.accounts,
		transactions: scope.transactions,
		multisignatures: scope.multisignatures,
	};

	__private.assetTypes[transactionTypes.MULTI].bind(scope.accounts);
};

/**
 * Checks if `modules` is loaded.
 *
 * @returns {boolean} True if `modules` is loaded
 */
Multisignatures.prototype.isLoaded = function() {
	return !!modules;
};

// Shared API
/**
 * @todo Implement API comments with apidoc
 * @see {@link http://apidocjs.com/}
 */
Multisignatures.prototype.shared = {
	/**
	 * Search accounts based on the query parameter passed.
	 *
	 * @param {Object} filters - Filters applied to results
	 * @param {string} filters.address - Account address
	 * @param {function} cb - Callback function
	 * @returns {setImmediateCallback} cb
	 */
	getGroups(filters, cb) {
		modules.multisignatures.getGroup(filters.address, (err, group) => {
			if (err) {
				return setImmediate(cb, err);
			}
			return setImmediate(cb, null, [group]);
		});
	},

	/**
	 * Search accounts based on the query parameter passed.
	 * @param {Object} filters - Filters applied to results.
	 * @param {string} filters.address - Account address.
	 * @param {function} cb - Callback function.
	 * @returns {setImmediateCallback} cb
	 */
	getMemberships(filters, cb) {
		const scope = {};

		async.series(
			{
				getAccount(seriesCb) {
					library.logic.account.get(
						{ address: filters.address },
						(err, account) => {
							if (err) {
								return setImmediate(seriesCb, err);
							}

							if (!account) {
								return setImmediate(
									seriesCb,
									new ApiError(
										'Multisignature membership account not found',
										errorCodes.NOT_FOUND
									)
								);
							}

							scope.targetAccount = account;

							return setImmediate(seriesCb);
						}
					);
				},
				getGroupAccountIds(seriesCb) {
					library.db.multisignatures
						.getGroupIds(scope.targetAccount.publicKey)
						.then(groupAccountIds => {
							scope.groups = [];

							async.each(
								groupAccountIds,
								(groupId, callback) => {
									modules.multisignatures.getGroup(groupId, (err, group) => {
										scope.groups.push(group);

										return setImmediate(callback);
									});
								},
								err => setImmediate(seriesCb, err)
							);
						});
				},
			},
			err => {
				if (err) {
					return setImmediate(cb, err);
				}
				return setImmediate(cb, null, scope.groups);
			}
		);
	},
};

// Export
module.exports = Multisignatures;
