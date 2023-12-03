import { Account, Contract, hash, RpcProvider } from "starknet";
import { getArgentXAddress, KeyPair, loadFromFile } from "./utils";
import { RPC_URL } from "./constants";

const provider = new RpcProvider({ nodeUrl: RPC_URL });

async function processKeyPairs(originalKeysFile: string, newKeysFile: string) {
  const originalPrivateKeys = await loadFromFile(originalKeysFile);
  const newPrivateKeys = await loadFromFile(newKeysFile);

  if (originalPrivateKeys.length !== newPrivateKeys.length) {
    throw new Error("Количество ключей в файлах не совпадает");
  }

  for (let i = 0; i < originalPrivateKeys.length; i++) {
    const originalPrivateKey = originalPrivateKeys[i];
    const newPrivateKey = newPrivateKeys[i];

    const address = getArgentXAddress(originalPrivateKey);
    const originalOwner = new KeyPair(originalPrivateKey);
    const newOwner = new KeyPair(newPrivateKey);

    console.log({
      address,
      originalOwnerPublicKey: "0x" + originalOwner.publicKey.toString(16),
      newOwnerPublicKey: "0x" + newOwner.publicKey.toString(16),
    });

    const changeOwnerSelector = hash.getSelectorFromName("change_owner");
    const chainId = await provider.getChainId();

    const messageHash = hash.computeHashOnElements([
      changeOwnerSelector,
      chainId,
      address,
      originalOwner.publicKey,
    ]);
    const [r, s] = newOwner.signHash(messageHash);

    const { abi } = await provider.getClassAt(address);
    const parsedAbi = abi.flatMap((e) => (e.type == "interface" ? e.items : e));
    const accountContract = new Contract(parsedAbi, address, provider);

    const account = new Account(provider, address, originalOwner, "1");

    accountContract.connect(account);

    const { transaction_hash } = await accountContract.change_owner(
      newOwner.publicKey,
      r,
      s,
    );

    console.log(`https://starkscan.co/tx/${transaction_hash}`);
  }

  console.log("DONE");
}

const originalKeysFile = "original-private-key.txt";
const newKeysFile = "new-private-key.txt";

processKeyPairs(originalKeysFile, newKeysFile);