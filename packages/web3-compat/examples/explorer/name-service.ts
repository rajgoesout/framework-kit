import { type Connection, PublicKey } from '@solana/web3-compat';

const NAME_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const SOL_TLD_AUTHORITY = new PublicKey('58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx');

async function getFilteredProgramAccounts(
	connection: Connection,
	programId: PublicKey,
	filters: Array<Record<string, unknown>>,
) {
	const accounts = await connection.getProgramAccounts(programId, { filters });
	return accounts.map(({ account, pubkey }) => ({
		account,
		publicKey: pubkey,
	}));
}

export async function getUserDomainAddressesExample(connection: Connection, userAddress: string): Promise<PublicKey[]> {
	const filters = [
		{
			memcmp: {
				bytes: SOL_TLD_AUTHORITY.toBase58(),
				offset: 0,
			},
		},
		{
			memcmp: {
				bytes: userAddress,
				offset: 32,
			},
		},
	];
	const accounts = await getFilteredProgramAccounts(connection, NAME_PROGRAM_ID, filters);
	return accounts.map((a) => a.publicKey);
}
