import {describe, it, expect} from 'vitest'
import {merkleRoot} from '../../src/main/p2p/utils/merkle'
import {displayHexToWire, wireToDisplayHex} from '../../src/main/p2p/utils/byteOrder'

// Real mainnet blocks, pulled over p2p. Between them they cover a row that
// needs no padding, a power-of-two tree, and two odd trees whose tail is
// duplicated at several levels.
const BLOCKS = [
  // mainnet h=2539089, 2 transactions
  {
    root: 'ea64b8deada2da0634c26945aabac006d2e22cfd4949b3d7aaf8d374fcfff741',
    txids: [
      'a89c72a86cb71b0e0e13d543d96f00946f6359e1e9e835b523f6548639b3197b',
      'eac83243d71ad9d1e020d90f76fb6a466337030f2d4b95474b20654be61fda8a',
    ],
  },
  // mainnet h=2000000, 4 transactions
  {
    root: '6538cb9636761c4a6385b245b4b330c76ba567e8797b22124a19226e359cb529',
    txids: [
      '8954c8546a4b19860afaaac95f14fc5909e9593b729b6d8228918d5deacfc222',
      '8da1f3663f69b390ee3344cfe45943b66bf5d21b2aa33dcd00929a0e4dea7b7d',
      'b12777a471eda6f934b91e783c532e2ab5387b4fef675eaa8ef4936b9d43d04b',
      'ac745767380eac6ba7065a34b460fae44b56d5f2c4f96afba9cdb0ef6d14501e',
    ],
  },
  // mainnet h=1000000, 5 transactions
  {
    root: '9ef887178b96765b5da30e363e5b8719199ba695d09b5e9da69b10a6251a5c59',
    txids: [
      'fbcf59eb9c21f4f23094101d2cf0ac3c58db9825dcc78dbb37395b4af5c87d44',
      '1f6ccbe9c27b3cba7060e11667657d563961dd62b302c49de20a108d9da02a74',
      '64bbc7737886f7839d5329a95c7ae8ba2f5c3a5fe64f7a760674e0490287456a',
      '2ff76b332b9cb1d22b3eb56e4328964c2e9d69e5e67fd74071cd2823fd7fbdab',
      '79497cea7b9f3ea8323dbcb1491c5ae355a987299f9aa3397b5d4374c3f51e90',
    ],
  },
  // mainnet h=2400000, 69 transactions
  {
    root: '9247dc06cf2e952b6a97d7c0057946933c1b5699ce6b76b86583775c26ae3b01',
    txids: [
      'd1a2fe8a942b06f478f3aab2b5f712bac1d98f1cb41058c60281bd856dab879d',
      '14c1ab77053d460ad221afc58c167a438669c31393e27002cade3e942cfa6ff8',
      '6273657e00d58bc7d9d766340659f7184843be0664d746e22daeac7d060449cd',
      '3ae1096e800c561383ff5d5ecd3cc2216c6d429a715a6031d881224acdcaa060',
      '77d7798c0a2567817becf6255633010f6a275deb44f0b740663369e444319b20',
      '949f8b4f83fb26cb042391dd2674df7858cdfec0647beab6b2b3ebcfdef19a69',
      '0556b9d67a1a1cfe6c87b947090797a8a6c40c452a2bdc4266ae0d62ed891819',
      'b9556667402c50e8ebd4df327583665e427fef636e391867ec74a785bf220a54',
      'a201d2dc6850649831ac89bd813198f67b089c73b63c8d0dc0e2aaf270794213',
      'f2c29219a8beb3f6f0f3678dffaee3dd25c39c57ed555c1e7076086b275479bf',
      'b231d7cda79f04628224b8d86a5fa4e4831b1546f57bd80da1b3fa82bdf7431a',
      'fedfb3d393683f711f1a208993a6c8d3f708c8d8969d019f6f7c365e499d7ba9',
      '02fc104d520a706776ec0c3b340433f6fed626e7ead25ef39552ef62c43f3ecb',
      '580e60724979cfba1029aa6643f597d7c3583368aa0f0f9ae238ec52fdbc2437',
      '38baf3c1d4218a62e8fa297a3cffcd4e7427f55ebb03996a4df26145599eaa13',
      '065fa8ee5542a0b66fda8b2cff3f25e0678e791cde7be583d4005403d5b0d212',
      '5a12806f7dc0be42691f9da885d32348369f017e9158b37089a65c6ff81ecb97',
      '7b48a89bfec752a5245d8a04b66a7980352965a467a98732936f6ef683e0eed1',
      'f9dafd5f7c2a1884b062d065c0a6bd5175e740c6f152610d5e3d2502aef50c16',
      '0ab234f6338163462d9d9fff71ecf545c848e74c21961d252d1f84a64cc5600f',
      '06d94b16b9787cf0ef25f398ce3502a390cda3ac78f39fd1cb23a58f33f71a1b',
      'e33d2529f92085c92e0c6d99d8b99a2a8432bb8ffcd3d8ecd634dafac741e21d',
      'a35aa6a25cac9d7a2478b36481a3760e959fdd6c8f34e027cd1ac2100d17013e',
      '401304cf97f811627dc016dada60a972fc054528eedb3d203aa1bb7f153bd244',
      'd45db1c3d823903caf283f6fe754704a8a4e89af69606dc5fe19bfa91ea87f96',
      '3216dc998e9933e4987509cac1ee859bb4814ee40547f5e23bf2b5425caccabe',
      '4580a2ac19d86e8fb0f589206047b6289c0d9646c6b2ab4889daedd0879675d9',
      '644d4e9454269593c0081ed484b5fad014f9a80959b68882f5019988d5dcfcdd',
      'c58bdf31932cae63429245348c7d5ae12fa22231753c68d6ba97515bf02036e3',
      'e29a9192111f06da563194fb655b1485e33f09a04046fa4a624d53d184df6df0',
      '90f4d8063b043254daedc59aebf84a501cf9076e48b75562a18ed240d124bb2b',
      '5f347d2514732d6a734d994628b35c5659ad5ac05a1299f42d334b8bd0e99930',
      '22217a1e9571f2f9e4c1274f5814be9aee4202debfc57a0a5d189fb5ff5a8834',
      'dd3e8fac25ca5ad738e419d6400531a92fe681f4cb8394d0ec9bcbc11047ad5e',
      'e3f00f3686f07cf47ac4e6745166fc24503189afaae6db3434cf4478ce801573',
      '3ffd85af6c7bfd382d701d794a952d02bc674d102932d6394d44b25e2c3b2d80',
      'c525dccbaf42f78098a517ea9a29fb3ecda8c4242b2bf06f838bfe8d31781289',
      'bd12ae41b37c0deb8f012a26e902e6632d25906c5d8a8df0a6d3845131a8bc94',
      'b8b092dbb567abbeee3ca398998c7748ca346300bc82387bd20c06aa4eb1a695',
      '926f16cb91e7a0b604de6a6c09fee7638672e6c50029ea642c48b7b90e098ea6',
      '925e7518e641ce01d233b34c6d1423efee0497c865fa2f47a22e8a8c4ed08eb6',
      '5c4c5628599dd5889970809cd09b71db5b9486078bf6cfe74c73d14f1a488fbe',
      '6ff9214ab10f28b62f93f08cb864f7018e8d67764d073b7fd08c1fd4dd390195',
      'f5b792305b08e5531328d1ef68619fd8516065cee3be7a7a78211c21b6ea4405',
      'e69ef93d549d1c9183f3e409e71fa310539bddcaa07185ecd92f933b7aefbb71',
      '27ec0bcf63d69244a4b8ab0ca8564f08ab6c502155cf3310b89b01b59e7fb9f0',
      '801bed822e075b5d7dbab15da47ecd9fa44579a665499d5dcd546abb6ee48fd2',
      'b963e61a5e23048466ae3113de8b9d852ffa643fc1d197b87c0a9bda28e22f47',
      '9ae6c8501cd1babb045af03706d875fddbc2f14e19afbc44e48c9d7d40aef181',
      '0b9b467375738c256c7d05ca31ab7704b4c1bd454c98a985b0e1da7cdc27ac3c',
      '2ca2c59ff8a051c6272fb835c0ec182368efc7693cbb9bc7f9d02b37507b797e',
      '1ae04f0ac7c1172ea6f1006f63ed25075d4ace994476bb1aee44ca3fc322d123',
      '2deb130babfdb6ab952b037bb5c26995e4abc297950483d381350e58c69ea929',
      'ae2cae19489f01403c4f87eb2d163446d220b8ba0b5a7462749f8ad33061c58b',
      'a8bce887b51b2705f9d43adbc406c2cbc1463f9ac83ba6aaa8a05adcdb635397',
      '0a1fbba56e63bec8a0997bf5484e351c4768ddc6a20cc5994bd9dbc04e90068d',
      '173bcfac8d8f8317d9bb89caa36ceaeee4fd1b58bec9cb994208bc38cb0802f9',
      'd559aa7532d4a031aa084f688a6c6e4349f9c1fccf6c88673917e88e8709ce12',
      '98b6f0f1ce94bdd7f7e2b103a7f8b100970971786db94afea75e65249812172f',
      '99da40f6898d797101054b70521232562bfc2675e19d4b99f65f58be5fa56f43',
      '85f3c08af809c56953241972d02bdbe74b2c7300466920b775b9f2d923c74360',
      '0db2327aacc21de9b479d997a494ff0a860e0d851b8af9200e5932d94dd773a7',
      'ed08531498a5b912039aa216d95033bd121dda47943931fe39874661b3978fa7',
      '90d9644282ec59b7a9f56995581da9994277e6bef75eaa9ea399a575ef7d5bab',
      '28ceb50004e63370e3b2975a99338719b4af7680dedb3b63976786dd928772ae',
      '653f6e5ca9bfeae3c959b1d004c4e17beb354d644979ef050676e1c3ae3f66b6',
      '86810ea5e4ce57fac7ea374420b8005024faa9e1f3981e2ec559b3dcd722d3bb',
      'e45e5aa5bcf32a6d24302c5e63c741606a1990859e38655552230f1cea8b85bc',
      'f67c3a5885242919e8531af0b868b69707c6b72e0df43f716af689a8eac42bf1',
    ],
  },
]

const leaves = (txids: string[]): Uint8Array[] => txids.map(displayHexToWire)

describe('merkleRoot', () => {
  for (const {root, txids} of BLOCKS) {
    it(`reproduces the root of a ${txids.length}-transaction block`, () => {
      expect(wireToDisplayHex(merkleRoot(leaves(txids))!)).toBe(root)
    })
  }

  it('is the txid itself for a block holding only its coinbase', () => {
    const only = BLOCKS[0]!.txids[0]!
    expect(wireToDisplayHex(merkleRoot(leaves([only]))!)).toBe(only)
  })

  it('has no root for an empty block', () => {
    expect(merkleRoot([])).toBeNull()
  })

  // A peer can append a copy of the last transaction to an odd block and reach
  // the same root, so the root stops identifying the list it came from.
  it('refuses a tree whose odd tail was duplicated by hand', () => {
    const {txids} = BLOCKS[2]!
    expect(txids.length % 2).toBe(1)
    expect(merkleRoot(leaves([...txids, txids[txids.length - 1]!]))).toBeNull()
  })

  it('refuses a duplicated pair anywhere in the tree', () => {
    const {txids} = BLOCKS[1]!
    const mutated = [...txids]
    mutated[1] = mutated[0]!
    expect(merkleRoot(leaves(mutated))).toBeNull()
  })
})
