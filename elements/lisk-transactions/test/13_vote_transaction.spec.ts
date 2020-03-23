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
import * as validUpvoteTransactionScenario from '../fixtures/vote_transaction/vote_transaction_10_upvotes.json';
import * as validDownvoteTransactionScenario from '../fixtures/vote_transaction/vote_transaction_10_downvotes.json';
import * as validMixvoteTransactionScenario from '../fixtures/vote_transaction/vote_transaction_10_upvotes_and_10_downvotes.json';

import { VoteTransaction } from '../src/13_vote_transaction';
import { Status, Account } from '../src';
import { defaultAccount, StateStoreMock } from './utils/state_store_mock';

describe('Vote transaction', () => {
	describe('validateAsset', () => {
		describe('when asset.votes contains valid contents', () => {
			it('should not return errors with valid upvote case', async () => {
				const tx = new VoteTransaction({
					...validUpvoteTransactionScenario.testCases.output,
				});
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.OK);
				expect(errors).toHaveLength(0);
			});

			it('should not return errors with valid downvote case', async () => {
				const tx = new VoteTransaction({
					...validDownvoteTransactionScenario.testCases.output,
				});
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.OK);
				expect(errors).toHaveLength(0);
			});

			it('should not return errors with valid mix votes case', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
				});
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.OK);
				expect(errors).toHaveLength(0);
			});
		});

		describe('when asset.votes does not include any vote', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validUpvoteTransactionScenario.testCases.output,
				});
				(tx.asset as any).votes = [];
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toInclude(
					'should NOT have fewer than 1 items',
				);
			});
		});

		describe('when asset.votes includes more than 20 elements', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
				});
				(tx.asset as any).votes = [
					...tx.asset.votes,
					{
						delegateAddress: '123L',
						amount: BigInt(10000000000),
					},
				];
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(2);
				expect(errors[0].message).toInclude(
					'should NOT have more than 20 items',
				);
			});
		});

		describe('when asset.votes includes more than 10 positive votes', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validUpvoteTransactionScenario.testCases.output,
				});
				(tx.asset as any).votes = [
					...tx.asset.votes,
					{
						delegateAddress: '123L',
						amount: BigInt(10000000000),
					},
				];
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toInclude(
					'Upvote can only be casted upto 10',
				);
			});
		});

		describe('when asset.votes includes more than 10 negative votes', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validDownvoteTransactionScenario.testCases.output,
				});
				(tx.asset as any).votes = [
					...tx.asset.votes,
					{
						delegateAddress: '123L',
						amount: BigInt(-10000000000),
					},
				];
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toInclude(
					'Downvote can only be casted upto 10',
				);
			});
		});

		describe('when asset.votes includes duplicate delegates within positive amount', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validUpvoteTransactionScenario.testCases.output,
					asset: {
						votes: [
							...validUpvoteTransactionScenario.testCases.output.asset.votes.slice(
								0,
							),
						],
					},
				});
				(tx.asset as any).votes[9] = {
					delegateAddress:
						validUpvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress,
					amount: BigInt(230000000000),
				};
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toInclude('Delegate address must be unique');
			});
		});

		describe('when asset.votes includes duplicate delegates within positive and negative amount', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					asset: {
						votes: [
							...validMixvoteTransactionScenario.testCases.output.asset.votes.slice(
								0,
							),
						],
					},
				});
				(tx.asset as any).votes[19] = {
					delegateAddress:
						validUpvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress,
					amount: BigInt(-230000000000),
				};
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toInclude('Delegate address must be unique');
			});
		});

		describe('when asset.votes includes zero amount', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					asset: {
						votes: [
							...validMixvoteTransactionScenario.testCases.output.asset.votes.slice(
								0,
							),
						],
					},
				});
				(tx.asset as any).votes[0] = {
					delegateAddress:
						validMixvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress,
					amount: BigInt(0),
				};
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toInclude('Amount cannot be 0');
			});
		});

		describe('when asset.votes includes amount which is greater than int64 range', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					asset: {
						votes: [
							...validMixvoteTransactionScenario.testCases.output.asset.votes.slice(
								0,
							),
						],
					},
				});
				(tx.asset as any).votes[0] = {
					delegateAddress:
						validMixvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress,
					amount: BigInt(2) ** BigInt(63),
				};
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors[0].message).toInclude('should match format "int64"');
			});
		});

		describe('when asset.votes includes amount which is less than int64 range', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					asset: {
						votes: [
							...validMixvoteTransactionScenario.testCases.output.asset.votes.slice(
								0,
							),
						],
					},
				});
				(tx.asset as any).votes[0] = {
					delegateAddress:
						validMixvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress,
					amount: BigInt(-1) * BigInt(2) ** BigInt(63),
				};
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors[0].message).toInclude('should match format "int64"');
			});
		});

		describe('when asset.votes includes amount which is not multiple of 10 * 10^8', () => {
			it('should return errors', async () => {
				const tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					asset: {
						votes: [
							...validMixvoteTransactionScenario.testCases.output.asset.votes.slice(
								0,
							),
						],
					},
				});
				(tx.asset as any).votes[0] = {
					delegateAddress:
						validMixvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress,
					amount: BigInt(100000000),
				};
				const { errors, status } = tx.validate();
				expect(status).toBe(Status.FAIL);
				expect(errors[0].message).toInclude(
					'Amount should be multiple of 10 * 10^8',
				);
			});
		});
	});

	describe('applyAsset', () => {
		const minBalance = BigInt('5000000');
		let store: StateStoreMock;
		let tx: VoteTransaction;

		describe('when asset.votes contain positive amount which makes account.votes to be 10 entries', () => {
			const originalVotes = BigInt('1000000000');

			beforeEach(async () => {
				tx = new VoteTransaction({
					...validUpvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validUpvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				const totalSpending =
					BigInt(validUpvoteTransactionScenario.testCases.output.fee) +
					validUpvoteTransactionScenario.testCases.output.asset.votes.reduce(
						(prev, current) => {
							if (BigInt(current.amount) > BigInt(0)) {
								return prev + BigInt(current.amount);
							}
							return prev;
						},
						BigInt(0),
					) +
					minBalance;
				const sender = {
					...defaultAccount,
					nonce: BigInt(validUpvoteTransactionScenario.testCases.output.nonce),
					address:
						validUpvoteTransactionScenario.testCases.input.account.address,
					balance: totalSpending,
					votes: [
						{
							delegateAddress:
								validUpvoteTransactionScenario.testCases.output.asset.votes[0]
									.delegateAddress,
							amount: originalVotes,
						},
					],
				};
				store = new StateStoreMock(
					[
						sender,
						...validUpvoteTransactionScenario.testCases.input.delegates.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.address,
								publicKey: delegate.publicKey,
								username: `delegate_${i}`,
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validUpvoteTransactionScenario.testCases.input.networkIdentifier,
					},
				);
				// Update delegate who originally have vote
				const delegate0 = await store.account.get(
					validUpvoteTransactionScenario.testCases.output.asset.votes[0]
						.delegateAddress,
				);
				delegate0.totalVotesReceived += BigInt('1000000000');
				store.account.set(delegate0.address, delegate0);
			});

			it('should not return error', async () => {
				const { errors, status } = await tx.apply(store);
				expect(status).toBe(Status.OK);
				expect(errors).toHaveLength(0);
			});

			it('should make account to have correct balance', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validUpvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.balance.toString()).toEqual(minBalance.toString());
			});

			it('should not change account.unlocking', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validUpvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.unlocking).toHaveLength(0);
			});

			it('should order account.votes', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validUpvoteTransactionScenario.testCases.input.account.address,
				);
				const senderVotesCopy = sender.votes.slice(0);
				senderVotesCopy.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				expect(sender.votes).toStrictEqual(senderVotesCopy);
			});

			it('should make upvoted delegate account to have correct totalVotesReceived', async () => {
				await tx.apply(store);
				expect.assertions(10);
				for (const vote of validUpvoteTransactionScenario.testCases.output.asset
					.votes) {
					const delegate = await store.account.get(vote.delegateAddress);
					if (
						vote.delegateAddress ===
						validUpvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress
					) {
						expect(delegate.totalVotesReceived.toString()).toEqual(
							(originalVotes + BigInt(vote.amount)).toString(),
						);
					} else {
						expect(delegate.totalVotesReceived.toString()).toEqual(
							BigInt(vote.amount).toString(),
						);
					}
				}
			});

			it('should create vote object when it does not exist before', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validUpvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.votes).toHaveLength(10);
			});
			it('should update vote object when it exists before and create if it does not exist', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validUpvoteTransactionScenario.testCases.input.account.address,
				);
				expect.assertions(10);
				for (const vote of sender.votes) {
					const relatedVote = validUpvoteTransactionScenario.testCases.output.asset.votes.find(
						entry => entry.delegateAddress === vote.delegateAddress,
					) as {
						delegateAddress: string;
						amount: string;
					};
					if (
						vote.delegateAddress ===
						validUpvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress
					) {
						const totalAmount = originalVotes + BigInt(relatedVote.amount);
						expect(vote.amount.toString()).toEqual(totalAmount.toString());
					} else {
						expect(vote.amount.toString()).toEqual(
							BigInt(relatedVote.amount).toString(),
						);
					}
				}
			});
		});

		describe('when asset.votes contain negative amount which makes account.votes to be 0 entries', () => {
			const originalVotes = BigInt('3000000000');

			beforeEach(async () => {
				tx = new VoteTransaction({
					...validDownvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validDownvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				const totalSpending =
					BigInt(validDownvoteTransactionScenario.testCases.output.fee) +
					minBalance;
				const sender = {
					...defaultAccount,
					nonce: BigInt(
						validDownvoteTransactionScenario.testCases.output.nonce,
					),
					address:
						validDownvoteTransactionScenario.testCases.input.account.address,
					balance: totalSpending,
					votes: [
						...validDownvoteTransactionScenario.testCases.output.asset.votes.map(
							vote => {
								if (
									vote.delegateAddress ===
									validDownvoteTransactionScenario.testCases.output.asset
										.votes[0].delegateAddress
								) {
									return {
										delegateAddress: vote.delegateAddress,
										amount: originalVotes + BigInt(vote.amount) * BigInt(-1),
									};
								}
								return {
									delegateAddress: vote.delegateAddress,
									amount: BigInt(vote.amount) * BigInt(-1),
								};
							},
						),
					],
					unlocking: [],
				};
				sender.votes.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				store = new StateStoreMock(
					[
						sender,
						...validDownvoteTransactionScenario.testCases.output.asset.votes.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.delegateAddress,
								username: `delegate_${i}`,
								totalVotesReceived: BigInt(delegate.amount) * BigInt(-1),
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validDownvoteTransactionScenario.testCases.input
								.networkIdentifier,
					},
				);
				// Update delegate who originally have vote
				const delegate0 = await store.account.get(
					validDownvoteTransactionScenario.testCases.output.asset.votes[0]
						.delegateAddress,
				);
				delegate0.totalVotesReceived += originalVotes;
				store.account.set(delegate0.address, delegate0);
			});

			it('should not return error', async () => {
				const { errors, status } = await tx.apply(store);
				expect(status).toBe(Status.OK);
				expect(errors).toHaveLength(0);
			});

			it('should not change account balance', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.balance.toString()).toEqual(minBalance.toString());
			});

			it('should remove vote which has zero amount', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.votes).toHaveLength(1);
			});

			it('should update vote which has non-zero amount', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.votes[0].amount.toString()).toEqual(
					originalVotes.toString(),
				);
			});

			it('should make account to have correct unlocking', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				expect.assertions(1 + 10 * 2);
				expect(sender.unlocking).toHaveLength(10);
				for (const unlock of sender.unlocking) {
					expect(unlock.unvoteHeight).toEqual(
						store.chain.lastBlockHeader.height + 1,
					);
					expect(BigInt(unlock.amount) > BigInt(0)).toBeTrue();
				}
			});

			it('should order account.unlocking', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				const expectedUnlock = validDownvoteTransactionScenario.testCases.output.asset.votes.map(
					vote => ({
						delegateAddress: vote.delegateAddress,
						amount: BigInt(-1) * BigInt(vote.amount),
						unvoteHeight: store.chain.lastBlockHeader.height + 1,
					}),
				);
				expectedUnlock.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress),
				);
				expect(sender.unlocking).toStrictEqual(expectedUnlock);
			});

			it('should make downvoted delegate account to have correct totalVotesReceived', async () => {
				await tx.apply(store);
				expect.assertions(10);
				for (const vote of validDownvoteTransactionScenario.testCases.output
					.asset.votes) {
					const delegate = await store.account.get(vote.delegateAddress);
					if (
						vote.delegateAddress ===
						validDownvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress
					) {
						expect(delegate.totalVotesReceived.toString()).toEqual(
							originalVotes.toString(),
						);
					} else {
						expect(delegate.totalVotesReceived.toString()).toEqual('0');
					}
				}
			});
		});

		describe('when asset.votes contain negative and positive amount which makes account.votes to be 10 entries', () => {
			beforeEach(async () => {
				tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validMixvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				const totalSpending =
					BigInt(validMixvoteTransactionScenario.testCases.output.fee) +
					validMixvoteTransactionScenario.testCases.output.asset.votes.reduce(
						(prev, current) => {
							if (BigInt(current.amount) > BigInt(0)) {
								return prev + BigInt(current.amount);
							}
							return prev;
						},
						BigInt(0),
					) +
					minBalance;
				const sender = {
					...defaultAccount,
					nonce: BigInt(validMixvoteTransactionScenario.testCases.output.nonce),
					address:
						validMixvoteTransactionScenario.testCases.input.account.address,
					balance: totalSpending,
					votes: [
						...validMixvoteTransactionScenario.testCases.output.asset.votes
							.filter(vote => BigInt(vote.amount) < BigInt(0))
							.map(vote => ({
								delegateAddress: vote.delegateAddress,
								amount: BigInt(vote.amount) * BigInt(-1),
							})),
					],
					unlocking: [
						{
							delegateAddress:
								validMixvoteTransactionScenario.testCases.output.asset.votes[0]
									.delegateAddress,
							amount: BigInt('1000000000'),
							unvoteHeight: 3,
						},
					],
				};
				sender.votes.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				store = new StateStoreMock(
					[
						sender,
						...validMixvoteTransactionScenario.testCases.output.asset.votes.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.delegateAddress,
								username: `delegate_${i}`,
								totalVotesReceived:
									BigInt(delegate.amount) < BigInt(0)
										? BigInt(delegate.amount) * BigInt(-1)
										: BigInt(0),
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validMixvoteTransactionScenario.testCases.input.networkIdentifier,
					},
				);
			});

			it('should not return error', async () => {
				const { errors, status } = await tx.apply(store);
				expect(status).toBe(Status.OK);
				expect(errors).toHaveLength(0);
			});

			it('should make account to have correct balance', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validMixvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.balance.toString()).toEqual(minBalance.toString());
			});

			it('should make account to have correct unlocking', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validMixvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender.unlocking).toHaveLength(11);
			});

			it('should order account.votes', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validMixvoteTransactionScenario.testCases.input.account.address,
				);
				const senderVotesCopy = sender.votes.slice(0);
				senderVotesCopy.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				expect(sender.votes).toStrictEqual(senderVotesCopy);
			});

			it('should order account.unlocking', async () => {
				await tx.apply(store);
				const sender = await store.account.get(
					validMixvoteTransactionScenario.testCases.input.account.address,
				);
				const senderUnlockingCopy = sender.unlocking.slice(0);
				senderUnlockingCopy.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				expect(sender.unlocking).toStrictEqual(senderUnlockingCopy);
			});

			it('should make upvoted delegate account to have correct totalVotesReceived', async () => {
				await tx.apply(store);
				const upvotes = validMixvoteTransactionScenario.testCases.output.asset.votes.filter(
					vote => BigInt(vote.amount) > BigInt(0),
				);
				for (const vote of upvotes) {
					const delegate = await store.account.get(vote.delegateAddress);
					expect(delegate.totalVotesReceived.toString()).toEqual(
						BigInt(vote.amount).toString(),
					);
				}
			});

			it('should make downvoted delegate account to have correct totalVotesReceived', async () => {
				await tx.apply(store);
				const downvotes = validMixvoteTransactionScenario.testCases.output.asset.votes.filter(
					vote => BigInt(vote.amount) < BigInt(0),
				);
				for (const vote of downvotes) {
					const delegate = await store.account.get(vote.delegateAddress);
					expect(delegate.totalVotesReceived.toString()).toEqual('0');
				}
			});

			it('shoud not change transaction asset', async () => {
				const txJSON = tx.toJSON();
				expect((txJSON.asset as any).votes).toStrictEqual(
					validMixvoteTransactionScenario.testCases.output.asset.votes,
				);
			});
		});

		describe('given asset.votes contain invalid data', () => {
			let sender: Account;
			let totalSpending: bigint;

			beforeEach(async () => {
				tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validMixvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				totalSpending =
					BigInt(validMixvoteTransactionScenario.testCases.output.fee) +
					validMixvoteTransactionScenario.testCases.output.asset.votes.reduce(
						(prev, current) => {
							if (BigInt(current.amount) > BigInt(0)) {
								return prev + BigInt(current.amount);
							}
							return prev;
						},
						BigInt(0),
					) +
					minBalance;
				sender = {
					...defaultAccount,
					nonce: BigInt(validMixvoteTransactionScenario.testCases.output.nonce),
					address:
						validMixvoteTransactionScenario.testCases.input.account.address,
					balance: totalSpending,
					votes: [
						...validMixvoteTransactionScenario.testCases.output.asset.votes
							.filter(vote => BigInt(vote.amount) < BigInt(0))
							.map(vote => ({
								delegateAddress: vote.delegateAddress,
								amount: BigInt(vote.amount) * BigInt(-1),
							})),
					],
					unlocking: [],
				};
				sender.votes.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				store = new StateStoreMock(
					[
						sender,
						...validMixvoteTransactionScenario.testCases.output.asset.votes.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.delegateAddress,
								username: `delegate_${i}`,
								totalVotesReceived:
									BigInt(delegate.amount) < BigInt(0)
										? BigInt(delegate.amount) * BigInt(-1)
										: BigInt(0),
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validMixvoteTransactionScenario.testCases.input.networkIdentifier,
					},
				);
			});

			describe('when asset.votes contain delegate address which is not registered', () => {
				it('should return errors', async () => {
					const vote = validMixvoteTransactionScenario.testCases.output.asset.votes.find(
						v => BigInt(v.amount) > BigInt(0),
					);

					const invalidDelegate = await store.account.get(
						vote?.delegateAddress as string,
					);
					store.account.set(invalidDelegate.address, {
						...defaultAccount,
						address: invalidDelegate.address,
					});

					const { errors, status } = await tx.apply(store);
					expect(status).toBe(Status.FAIL);
					expect(errors).toHaveLength(1);
					expect(errors[0].message).toInclude(
						'Voted delegate is not registered',
					);
				});
			});

			describe('when asset.votes positive amount makese account.votes entries more than 10', () => {
				it('should return errors', async () => {
					const invalidSender = await store.account.get(sender.address);
					invalidSender.votes.unshift({
						delegateAddress: '123L',
						amount: BigInt('1000000000'),
					});
					store.account.set(invalidSender.address, invalidSender);

					const { errors, status } = await tx.apply(store);
					expect(status).toBe(Status.FAIL);
					expect(errors).toHaveLength(1);
					expect(errors[0].message).toInclude('Account can only vote upto 10');
				});
			});

			describe('when the last asset.votes amount makes sender not having sufficient balance', () => {
				it('should return errors', async () => {
					const invalidSender = await store.account.get(sender.address);
					invalidSender.balance -= BigInt(1);
					store.account.set(invalidSender.address, invalidSender);

					const { errors, status } = await tx.apply(store);
					expect(status).toBe(Status.FAIL);
					expect(errors).toHaveLength(1);
					expect(errors[0].message).toInclude(
						'Account does not have enough minimum remaining',
					);
				});
			});

			describe('when asset.votes negative amount decrease acount.votes entries yet positive amount makes account exceeds more than 10', () => {
				it('should return errors', async () => {
					const firstNegative = validMixvoteTransactionScenario.testCases.output.asset.votes.find(
						vote => BigInt(vote.amount) < BigInt(0),
					);
					const invalidSender = await store.account.get(sender.address);
					const index = invalidSender.votes.findIndex(
						v => v.delegateAddress === firstNegative?.delegateAddress,
					);
					invalidSender.votes[index].amount += BigInt(1000000000);
					store.account.set(invalidSender.address, invalidSender);

					const { errors, status } = await tx.apply(store);
					expect(status).toBe(Status.FAIL);
					expect(errors).toHaveLength(1);
					expect(errors[0].message).toInclude('Account can only vote upto 10');
				});
			});

			describe('when asset.votes negative amount and makes account.unlocking more than 20 entries', () => {
				it('should return errors', async () => {
					const invalidSender = await store.account.get(sender.address);
					invalidSender.unlocking = [
						{
							delegateAddress: '123L',
							amount: BigInt(1000000000),
							unvoteHeight: 2,
						},
						...validMixvoteTransactionScenario.testCases.output.asset.votes
							.filter(vote => BigInt(vote.amount) < BigInt(0))
							.map(vote => ({
								delegateAddress: vote.delegateAddress,
								amount: BigInt(vote.amount) * BigInt(-1),
								unvoteHeight: 2,
							})),
					];
					sender.unlocking.sort((a, b) =>
						a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
					);
					store.account.set(invalidSender.address, invalidSender);

					const { errors, status } = await tx.apply(store);
					expect(status).toBe(Status.FAIL);
					expect(errors).toHaveLength(1);
					expect(errors[0].message).toInclude(
						'Cannot downvote which exceeds account.unlocking to have more than 20',
					);
				});
			});

			describe('when asset.votes negative amount exceeds the previously voted amount', () => {
				it('should return errors', async () => {
					const firstNegative = validMixvoteTransactionScenario.testCases.output.asset.votes.find(
						vote => BigInt(vote.amount) < BigInt(0),
					);
					const invalidSender = await store.account.get(sender.address);
					const index = invalidSender.votes.findIndex(
						v => v.delegateAddress === firstNegative?.delegateAddress,
					);
					invalidSender.votes[index].amount -= BigInt(1000000000);
					store.account.set(invalidSender.address, invalidSender);

					const { errors, status } = await tx.apply(store);
					expect(status).toBe(Status.FAIL);
					expect(errors).toHaveLength(2);
					expect(errors[0].message).toInclude(
						'Cannot downvote more than upvoted',
					);
				});
			});
		});
	});

	describe('undoAsset', () => {
		const minBalance = BigInt('5000000');

		let store: StateStoreMock;
		let tx: VoteTransaction;
		let originalAccount: Account;
		let originalDeleates: Account[];

		describe('when asset.votes contain positive amount which makes account.votes to be 10 entries', () => {
			const originalVotes = BigInt('1000000000');

			beforeEach(async () => {
				tx = new VoteTransaction({
					...validUpvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validUpvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				const totalSpending =
					BigInt(validUpvoteTransactionScenario.testCases.output.fee) +
					validUpvoteTransactionScenario.testCases.output.asset.votes.reduce(
						(prev, current) => {
							if (BigInt(current.amount) > BigInt(0)) {
								return prev + BigInt(current.amount);
							}
							return prev;
						},
						BigInt(0),
					) +
					minBalance;
				const sender = {
					...defaultAccount,
					nonce: BigInt(validUpvoteTransactionScenario.testCases.output.nonce),
					address:
						validUpvoteTransactionScenario.testCases.input.account.address,
					publicKey:
						validUpvoteTransactionScenario.testCases.input.account.publicKey,
					balance: totalSpending,
					votes: [
						{
							delegateAddress:
								validUpvoteTransactionScenario.testCases.output.asset.votes[0]
									.delegateAddress,
							amount: originalVotes,
						},
					],
				};
				originalAccount = {
					...sender,
					votes: [...sender.votes],
				};
				originalDeleates = validUpvoteTransactionScenario.testCases.input.delegates.map(
					(delegate, i) => ({
						...defaultAccount,
						address: delegate.address,
						publicKey: delegate.publicKey,
						username: `delegate_${i}`,
					}),
				);
				store = new StateStoreMock(
					[
						sender,
						...validUpvoteTransactionScenario.testCases.input.delegates.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.address,
								publicKey: delegate.publicKey,
								username: `delegate_${i}`,
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validUpvoteTransactionScenario.testCases.input.networkIdentifier,
					},
				);
				// Update delegate who originally have vote
				const delegate0 = await store.account.get(
					validUpvoteTransactionScenario.testCases.output.asset.votes[0]
						.delegateAddress,
				);
				delegate0.totalVotesReceived += BigInt('1000000000');
				store.account.set(delegate0.address, delegate0);
			});

			it('should not return error', async () => {
				const { errors: applyErrors, status: applyStatus } = await tx.apply(
					store,
				);
				expect(applyErrors).toHaveLength(0);
				expect(applyStatus).toBe(Status.OK);
				const { errors, status } = await tx.undo(store);
				expect(errors).toHaveLength(0);
				expect(status).toBe(Status.OK);
			});

			it('should make account to have original values before apply', async () => {
				await tx.apply(store);
				await tx.undo(store);
				const sender = await store.account.get(
					validUpvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender).toStrictEqual(originalAccount);
			});

			it('should make upvoted delegate account to have original values before apply', async () => {
				await tx.apply(store);
				await tx.undo(store);
				for (const delegate of originalDeleates) {
					if (
						delegate.address ===
						validUpvoteTransactionScenario.testCases.output.asset.votes[0]
							.delegateAddress
					) {
						delegate.totalVotesReceived = BigInt('1000000000');
					}
					const updatedDelegate = await store.account.get(delegate.address);
					expect(updatedDelegate).toStrictEqual(delegate);
				}
			});
		});

		describe('when asset.votes contain negative amount which makes account.votes to be 0 entries', () => {
			const originalVotes = BigInt('3000000000');

			beforeEach(async () => {
				tx = new VoteTransaction({
					...validDownvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validDownvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				const totalSpending =
					BigInt(validDownvoteTransactionScenario.testCases.output.fee) +
					minBalance;
				const sender = {
					...defaultAccount,
					nonce: BigInt(
						validDownvoteTransactionScenario.testCases.output.nonce,
					),
					address:
						validDownvoteTransactionScenario.testCases.input.account.address,
					publicKey:
						validDownvoteTransactionScenario.testCases.input.account.publicKey,
					balance: totalSpending,
					votes: [
						...validDownvoteTransactionScenario.testCases.output.asset.votes.map(
							vote => {
								if (
									vote.delegateAddress ===
									validDownvoteTransactionScenario.testCases.output.asset
										.votes[0].delegateAddress
								) {
									return {
										delegateAddress: vote.delegateAddress,
										amount: originalVotes + BigInt(vote.amount) * BigInt(-1),
									};
								}
								return {
									delegateAddress: vote.delegateAddress,
									amount: BigInt(vote.amount) * BigInt(-1),
								};
							},
						),
					],
					unlocking: [],
				};
				sender.votes.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);
				originalAccount = {
					...sender,
					votes: [
						...sender.votes.map(v => ({
							delegateAddress: v.delegateAddress,
							amount: v.amount,
						})),
					],
				};
				originalDeleates = validDownvoteTransactionScenario.testCases.output.asset.votes.map(
					(delegate, i) => ({
						...defaultAccount,
						address: delegate.delegateAddress,
						username: `delegate_${i}`,
						totalVotesReceived: BigInt(delegate.amount) * BigInt(-1),
					}),
				);
				store = new StateStoreMock(
					[
						sender,
						...validDownvoteTransactionScenario.testCases.output.asset.votes.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.delegateAddress,
								username: `delegate_${i}`,
								totalVotesReceived: BigInt(delegate.amount) * BigInt(-1),
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validDownvoteTransactionScenario.testCases.input
								.networkIdentifier,
					},
				);
				// Update delegate who originally have vote
				const delegate0 = await store.account.get(
					validDownvoteTransactionScenario.testCases.output.asset.votes[0]
						.delegateAddress,
				);
				delegate0.totalVotesReceived += originalVotes;
				store.account.set(delegate0.address, delegate0);
				const delegateIndex = originalDeleates.findIndex(
					original => original.address === delegate0.address,
				);
				originalDeleates[delegateIndex].totalVotesReceived += originalVotes;
			});

			it('should not return error', async () => {
				const { errors: applyErrors, status: applyStatus } = await tx.apply(
					store,
				);
				expect(applyErrors).toHaveLength(0);
				expect(applyStatus).toBe(Status.OK);
				const { errors, status } = await tx.undo(store);
				expect(errors).toHaveLength(0);
				expect(status).toBe(Status.OK);
			});

			it('should make account to have original values before apply', async () => {
				await tx.apply(store);
				await tx.undo(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender).toStrictEqual(originalAccount);
			});

			it('should make downvoted delegate account to have original values before apply', async () => {
				await tx.apply(store);
				await tx.undo(store);
				for (const delegate of originalDeleates) {
					const updatedDelegate = await store.account.get(delegate.address);
					expect(updatedDelegate).toStrictEqual(delegate);
				}
			});
		});

		describe('when asset.votes contain negative and positive amount which makes account.votes to be 10 entries', () => {
			beforeEach(async () => {
				tx = new VoteTransaction({
					...validMixvoteTransactionScenario.testCases.output,
					networkIdentifier:
						validMixvoteTransactionScenario.testCases.input.networkIdentifier,
				});
				const totalSpending =
					BigInt(validMixvoteTransactionScenario.testCases.output.fee) +
					validMixvoteTransactionScenario.testCases.output.asset.votes.reduce(
						(prev, current) => {
							if (BigInt(current.amount) > BigInt(0)) {
								return prev + BigInt(current.amount);
							}
							return prev;
						},
						BigInt(0),
					) +
					minBalance;
				const sender = {
					...defaultAccount,
					nonce: BigInt(validMixvoteTransactionScenario.testCases.output.nonce),
					address:
						validMixvoteTransactionScenario.testCases.input.account.address,
					publicKey:
						validMixvoteTransactionScenario.testCases.input.account.publicKey,
					balance: totalSpending,
					votes: [
						...validMixvoteTransactionScenario.testCases.output.asset.votes
							.filter(vote => BigInt(vote.amount) < BigInt(0))
							.map(vote => ({
								delegateAddress: vote.delegateAddress,
								amount: BigInt(vote.amount) * BigInt(-1),
							})),
					],
					unlocking: [
						{
							delegateAddress:
								validMixvoteTransactionScenario.testCases.output.asset.votes[0]
									.delegateAddress,
							amount: BigInt('1000000000'),
							unvoteHeight: 3,
						},
					],
				};
				sender.votes.sort((a, b) =>
					a.delegateAddress.localeCompare(b.delegateAddress, 'en'),
				);

				originalAccount = {
					...sender,
					votes: [
						...sender.votes.map(v => ({
							delegateAddress: v.delegateAddress,
							amount: v.amount,
						})),
					],
				};
				originalDeleates = validMixvoteTransactionScenario.testCases.output.asset.votes.map(
					(delegate, i) => ({
						...defaultAccount,
						address: delegate.delegateAddress,
						username: `delegate_${i}`,
						totalVotesReceived:
							BigInt(delegate.amount) < BigInt(0)
								? BigInt(delegate.amount) * BigInt(-1)
								: BigInt(0),
					}),
				);
				store = new StateStoreMock(
					[
						sender,
						...validMixvoteTransactionScenario.testCases.output.asset.votes.map(
							(delegate, i) => ({
								...defaultAccount,
								address: delegate.delegateAddress,
								username: `delegate_${i}`,
								totalVotesReceived:
									BigInt(delegate.amount) < BigInt(0)
										? BigInt(delegate.amount) * BigInt(-1)
										: BigInt(0),
							}),
						),
					],
					{
						lastBlockHeader: { height: 10 } as any,
						networkIdentifier:
							validMixvoteTransactionScenario.testCases.input.networkIdentifier,
					},
				);
			});

			it('should not return error', async () => {
				const { errors: applyErrors, status: applyStatus } = await tx.apply(
					store,
				);
				expect(applyErrors).toHaveLength(0);
				expect(applyStatus).toBe(Status.OK);
				const { errors, status } = await tx.undo(store);
				expect(errors).toHaveLength(0);
				expect(status).toBe(Status.OK);
			});

			it('should make account to have original values before apply', async () => {
				await tx.apply(store);
				await tx.undo(store);
				const sender = await store.account.get(
					validDownvoteTransactionScenario.testCases.input.account.address,
				);
				expect(sender).toStrictEqual(originalAccount);
			});

			it('should make delegate accounts to have original values before apply', async () => {
				await tx.apply(store);
				await tx.undo(store);
				for (const delegate of originalDeleates) {
					const updatedDelegate = await store.account.get(delegate.address);
					expect(updatedDelegate).toStrictEqual(delegate);
				}
			});
		});
	});
});
