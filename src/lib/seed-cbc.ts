// SEED-CBC Decryption Implementation (Client-Side)
// Ported from ISASSeedCBC.java (Official Coocon Library)

// S-Boxes (Standard SEED S-Boxes)
const SS0 = new Uint32Array([
    0x2989a1a8, 0x05858184, 0x16c6d2d4, 0x13c3d3d0, 0x14445054, 0x2d0d090c, 0x2181a5a4, 0x2909a1a8,
    0x11415554, 0x0b8b8f8c, 0x32427672, 0x2080a4a0, 0x2282a6a2, 0x1b4b5f5e, 0x09090100, 0x3d0d3938,
    0x0a8a8e8a, 0x3b0b3f3e, 0x1f4f5b5e, 0x1c4c585c, 0x1c0c181c, 0x18485c58, 0x02828682, 0x01818584,
    0x39093d38, 0x21416564, 0x2f0f2b2e, 0x16465256, 0x17475352, 0x08480c08, 0x2f4f6b6e, 0x30407470,
    0x0f4f0b0e, 0x18889c98, 0x19495d5c, 0x15c5d1d4, 0x38487c78, 0x09898d88, 0x12c2d6d2, 0x08080000,
    0x1d4d5958, 0x20406460, 0x12425652, 0x0b4b4f4e, 0x0d4d4948, 0x14c4d0d4, 0x04848084, 0x2585a1a4,
    0x36467276, 0x0a4a4e4a, 0x3d4d7978, 0x0c8c888c, 0x34043034, 0x33437772, 0x3f4f7b7e, 0x14849094,
    0x13839390, 0x24446064, 0x2e0e2a2e, 0x28082c28, 0x34447074, 0x0e8e8a8e, 0x11819594, 0x2c4c686c,
    0x2a0a2e2a, 0x03838782, 0x0d0d090c, 0x19899d98, 0x02020602, 0x37477372, 0x00808480, 0x31013534,
    0x1f8f9f9e, 0x17071312, 0x1b0b1f1e, 0x0f8f8b8e, 0x3a4a7e7a, 0x3c4c787c, 0x15051114, 0x22c2e6e2,
    0x03434742, 0x05454144, 0x26466266, 0x07474346, 0x1d8d9998, 0x19091d1c, 0x11011514, 0x2d4d696c,
    0x3a8abeba, 0x06868286, 0x16869692, 0x2484a0a4, 0x2c0c282c, 0x2787a3a6, 0x25456164, 0x2a4a6e6a,
    0x3f0f3b3e, 0x2b4b6f6e, 0x06060206, 0x22426662, 0x35053134, 0x28486c68, 0x0e0e0a0e, 0x0d8d898c,
    0x02424642, 0x31417574, 0x3e4e7a7e, 0x2f8fafae, 0x21c1e5e4, 0x24042024, 0x1a8a9e9a, 0x05c5c1c4,
    0x2b0b2f2e, 0x2b8bafae, 0x1e8e9e9a, 0x07070306, 0x3686b2b6, 0x2d8daddc, 0x1a0a1e1a, 0x35457174,
    0x1c8c989c, 0x06464246, 0x3c0c383c, 0x2e4e6a6e, 0x12829692, 0x10809490, 0x37073332, 0x2383a7a2,
    0x25052124, 0x3282b6b2, 0x2888ac88, 0x20c0e4e0, 0x10001410, 0x04040004, 0x1a4a5e5a, 0x1e0e1a1e,
    0x0e4e4a4e, 0x18081c18, 0x15859194, 0x29496d68, 0x39497d78, 0x3989bdb8, 0x11c1d5d4, 0x0b0b0f0c,
    0x00404440, 0x3d8dbdbc, 0x27072322, 0x1b8b9f9e, 0x04444044, 0x10405450, 0x3080b4b0, 0x3585b1b4,
    0x01414544, 0x1f0f1b1e, 0x26062226, 0x2686a2a6, 0x23032722, 0x32023632, 0x33033732, 0x01010504,
    0x3484b0b4, 0x23436762, 0x0c4c484c, 0x17879392, 0x3888bcb8, 0x3e8ebeqe, 0x0f0f0b0e, 0x38083c38,
    0x01c1c5c4, 0x05050100, 0x15455154, 0x07878386, 0x24c4e0e4, 0x30003430, 0x14041014, 0x1d0d1918,
    0x3787b3b2, 0x3b4b7f7e, 0x00000400, 0x19c9dddc, 0x3b8bbeba, 0x27476366, 0x13435350, 0x3c8cccc8,
    0x36063236, 0x0fcfebe3, 0x03030702, 0x1e4e5a5e, 0x13031712, 0x0a0a0e0a, 0x0c0c080c, 0x3181b5b4,
    0x29c9e9e8, 0x3383b7b2, 0x08888c88, 0x07c7c3c6, 0x3e0e3a3e, 0x22022622, 0x3f8ffeff, 0x00c0c4c0,
    0x2c8c686c, 0x2a8aeaea, 0x21012524, 0x26c6e2e6, 0x2e8eaea2, 0x3d4d7978, 0x20002420, 0x2d4d696c,
    0x09490d08, 0x0f0f4b4e, 0x18485c58, 0x0b8b8f8c
]);

const SS1 = new Uint32Array([
    0x3838083c, 0xe828c868, 0x2c6c4c68, 0x64246424, 0xd090d090, 0x9a5a1a5a, 0xf2b2f2b2, 0xd888d898,
    0x50105010, 0xe424e464, 0x5a1a5a1a, 0x06460646, 0x08480848, 0x8aca8a4a, 0xe222a262, 0x8e8ece8e,
    0x1c5c1c5c, 0x7c7c3c7c, 0xecacac6c, 0xbc7c7c3c, 0x60206020, 0x3a7a7a3a, 0x3e7e7e3e, 0x14541454,
    0x22622262, 0xe6a6a666, 0x90d090d0, 0x82c282c2, 0x12521252, 0xf6b6f6b6, 0x9e1e9e1e, 0x78387878,
    0xcc8c8c4c, 0x20602060, 0xb8f8b8f8, 0xc404c404, 0x66266626, 0x6e2e6e2e, 0xc080c080, 0x34743474,
    0x82c2c282, 0x2a6a2a6a, 0x44044404, 0xd292d292, 0x98d898d8, 0x32723272, 0x48084808, 0xfebebe7e,
    0x40004000, 0x1e5e1e5e, 0xd494d494, 0x72327232, 0x5e1e5e1e, 0xf4b4f4b4, 0x02420242, 0x8e8e8e0e,
    0xc606c606, 0x9e5e9e5e, 0x0e4e0e4e, 0x86c686c6, 0xb4f4b4f4, 0xeeaeae6e, 0x4c0c4c0c, 0x1a5a1a5a,
    0xb6f6f6b6, 0x24642464, 0xc6064606, 0xf838b878, 0xb8f87838, 0xac6c6c2c, 0xf8b8b878, 0x16561656,
    0x96d696d6, 0xe4a4a464, 0x26662666, 0x76367636, 0x58185818, 0xa464a464, 0x92d292d2, 0xc080a080,
    0x62226222, 0x42024202, 0x16565616, 0x80c080c0, 0xe0a0e0a0, 0x68286828, 0x0a4a4a0a, 0x9c5c9c5c,
    0xc282c282, 0x80c00040, 0xba7afa3a, 0x4a0a4a0a, 0x28682828, 0xd696d696, 0x22626222, 0xae6eae2e,
    0x54145414, 0xccc8c888, 0xce8ece8e, 0x0c4c0c4c, 0xa262a262, 0x6a2a6a2a, 0x10501050, 0x88c888c8,
    0x04440444, 0x74347434, 0xaa6aaa2a, 0xba3afa3a, 0x56165616, 0x5c1c5c1c, 0x00400040, 0x52125212,
    0xd6965616, 0xca8a4a0a, 0xfc3cbc7c, 0x18581858, 0x6e2e2e6e, 0x0a4a0a4a, 0x58581858, 0x8c8c4c0c,
    0x30307030, 0x2e6e2e6e, 0xc888c888, 0xea2a6a2a, 0xc484c484, 0x5e5e1e5e, 0xf2b2b2f2, 0xeeae6e2e,
    0xa060a060, 0x8c8c0c4c, 0x8686c686, 0x4e0e4e0e, 0xcc8c4c0c, 0x7a3a7a3a, 0x6c2c6c2c, 0x04044404,
    0x26266626, 0x62222262, 0x3c7c7c3c, 0xe020a020, 0xca8a8a4a, 0x18185818, 0xacecec6c, 0x02024202,
    0xf0b0f0b0, 0xd49494d4, 0xbc3c7c3c, 0xda9a9a5a, 0x96d65616, 0xe8a8a868, 0x3f7f3f3f, 0xecac6cac,
    0x9a9a5a1a, 0xc808c808, 0xea6a2a6a, 0x46064606, 0x24246424, 0x38783838, 0xd8989858, 0xfa3aba7a,
    0xb030f070, 0x36763676, 0x30703070, 0x68682868, 0x94541454, 0x7e3e7e3e, 0x76763636, 0xb0707030,
    0x66662626, 0x4e4e0e0e, 0xa666a666, 0x1c1c5c1c, 0x70703030, 0xd0905010, 0x54541414, 0xbcbcb878,
    0x9494d494, 0x10105010, 0x34347434, 0xc2828242, 0x36767636, 0xae2e6e2e, 0x20206020, 0x14145414,
    0x64642424, 0x42420202, 0x7e7e3e3e, 0x72723232, 0xfa7a3a3a, 0xdc9c9c5c, 0x08084808, 0xcecec686,
    0x98589858, 0x4a4a0a0a, 0xde9e5e1e, 0x44440404, 0x52521212, 0xe2a2a262, 0x8a8a4a0a, 0x28286828,
    0x78783838, 0x40400000, 0x00004040, 0xe6666626, 0xda5a9a5a, 0x46460606, 0x0e0e4e4e, 0xde9e9e5e,
    0xfe7e3e7e, 0x9090d0d0, 0x6a6a2a2a, 0x92529252, 0x60602020, 0x32327272, 0x48480808, 0x8484c4c4
]);

const SS2 = new Uint32Array([
    0xa1a82989, 0x81840585, 0xd2d416c6, 0xd3d013c3, 0x50541444, 0x090c2d0d, 0xa5a42181, 0xa1a82909,
    0x55541141, 0x8f8c0b8b, 0x76723242, 0xa4a02080, 0xa6a22282, 0x5f5e1b4b, 0x01000909, 0x39383d0d,
    0x8e8a0a8a, 0x3f3e3b0b, 0x5b5e1f4f, 0x585c1c4c, 0x181c1c0c, 0x5c581848, 0x86820282, 0x85840181,
    0x3d383909, 0x65642141, 0x2b2e2f0f, 0x52561646, 0x53521747, 0x0c080848, 0x6b6e2f4f, 0x74703040,
    0x0b0e0f4f, 0x9c981888, 0x5d5c1949, 0xd1d415c5, 0x7c783848, 0x8d880989, 0xd6d212c2, 0x00000808,
    0x59581d4d, 0x64602040, 0x56521242, 0x4f4e0b4b, 0x49480d4d, 0xd0d414c4, 0x80840484, 0xa1a42585,
    0x72763646, 0x4e4a0a4a, 0x79783d4d, 0x888c0c8c, 0x30343404, 0x77723343, 0x7b7e3f4f, 0x90941484,
    0x93901383, 0x60642444, 0x2a2e2e0e, 0x2c282808, 0x70743444, 0x8a8e0e8e, 0x95941181, 0x686c2c4c,
    0x2e2a2a0a, 0x87820383, 0x090c0d0d, 0x9d981989, 0x06020202, 0x73723747, 0x84800080, 0x35343101,
    0x9f9e1f8f, 0x13121707, 0x1f1e1b0b, 0x8b8e0f8f, 0x7e7a3a4a, 0x787c3c4c, 0x11141505, 0xe6e222c2,
    0x47420343, 0x41440545, 0x62662646, 0x43460747, 0x99981d8d, 0x1d1c1909, 0x15141101, 0x696c2d4d,
    0xbeba3a8a, 0x82860686, 0x96921686, 0xa0a42484, 0x282c2c0c, 0xa3a62787, 0x61642545, 0x6e6a2a4a,
    0x3b3e3f0f, 0x6f6e2b4b, 0x02060606, 0x66622242, 0x31343505, 0x6c682848, 0x0a0e0e0e, 0x898c0d8d,
    0x46420242, 0x75743141, 0x7a7e3e4e, 0xafae2f8f, 0xe5e421c1, 0x20242404, 0x9e9a1a8a, 0xc1c405c5,
    0x2f2e2b0b, 0xafae2b8b, 0x9e9a1e8e, 0x03060707, 0xb2b63686, 0xaddc2d8d, 0x1e1a1a0a, 0x71743545,
    0x989c1c8c, 0x42460646, 0x383c3c0c, 0x6a6e2e4e, 0x96921282, 0x94901080, 0x33323707, 0xa7a22383,
    0x21242505, 0xb6b23282, 0xac882888, 0xe4e020c0, 0x14101000, 0x00040404, 0x5e5a1a4a, 0x1a1e1e0e,
    0x4a4e0e4e, 0x1c181808, 0x91941585, 0x6d682949, 0x7d783949, 0xbdb83989, 0xd5d411c1, 0x0f0c0b0b,
    0x44400040, 0xbdbc3d8d, 0x23222707, 0x9f9e1b8b, 0x40440444, 0x54501040, 0xb4b03080, 0xb1b43585,
    0x45440141, 0x1b1e1f0f, 0x22262606, 0xa2a62686, 0x27222303, 0x36323202, 0x37323303, 0x05040101,
    0xb0b43484, 0x67622343, 0x484c0c4c, 0x93921787, 0xbcb83888, 0xbeqe3e8e, 0x0b0e0f0f, 0x3c383808,
    0xc5c401c1, 0x01000505, 0x51541545, 0x83860787, 0xe0e424c4, 0x34303000, 0x10141404, 0x19181d0d,
    0xb3b23787, 0x7f7e3b4b, 0x04000000, 0xdddc19c9, 0xbeba3b8b, 0x63662747, 0x53501343, 0xccc83c8c,
    0x32363606, 0xebe30fcf, 0x07020303, 0x5a5e1e4e, 0x17121303, 0x0e0a0a0a, 0x080c0c0c, 0xb5b43181,
    0xe9e829c9, 0xb7b23383, 0x8c880888, 0xc3c607c7, 0x3a3e3e0e, 0x26222202, 0xfeff3f8f, 0xc4c000c0,
    0x686c2c8c, 0xeaea2a8a, 0x25242101, 0xe2e626c6, 0xaea22e8e, 0x79783d4d, 0x24202000, 0x696c2d4d,
    0x0d080949, 0x4b4e0f0f, 0x5c581848, 0x8f8c0b8b
]);

const SS3 = new Uint32Array([
    0x083c3838, 0xc868e828, 0x4c682c6c, 0x64246424, 0xd090d090, 0x1a5a9a5a, 0xf2b2f2b2, 0xd898d888,
    0x50105010, 0xe464e424, 0x5a1a5a1a, 0x06460646, 0x08480848, 0x8a4a8aca, 0xa262e222, 0xce8e8e8e,
    0x1c5c1c5c, 0x3c7c7c7c, 0xac6cecac, 0x7c3cbc7c, 0x60206020, 0x7a3a3a7a, 0x7e3e3e7e, 0x14541454,
    0x22622262, 0xa666e6a6, 0x90d090d0, 0x82c282c2, 0x12521252, 0xf6b6f6b6, 0x9e1e9e1e, 0x78787838,
    0x8c4ccc8c, 0x20602060, 0xb8f8b8f8, 0xc404c404, 0x66266626, 0x6e2e6e2e, 0xc080c080, 0x34743474,
    0xc28282c2, 0x2a6a2a6a, 0x44044404, 0xd292d292, 0x98d898d8, 0x32723272, 0x48084808, 0xbe7efebe,
    0x40004000, 0x1e5e1e5e, 0xd494d494, 0x72327232, 0x5e1e5e1e, 0xf4b4f4b4, 0x02420242, 0x8e0e8e8e,
    0xc606c606, 0x9e5e9e5e, 0x0e4e0e4e, 0x86c686c6, 0xb4f4b4f4, 0xae6eeeae, 0x4c0c4c0c, 0x1a5a1a5a,
    0xf6b6b6f6, 0x24642464, 0x4606c606, 0xb878f838, 0x7838b8f8, 0x6c2cac6c, 0xb878f8b8, 0x16561656,
    0x96d696d6, 0xa464e4a4, 0x26662666, 0x76367636, 0x58185818, 0xa464a464, 0x92d292d2, 0xa080c080,
    0x62226222, 0x42024202, 0x56161656, 0x80c080c0, 0xe0a0e0a0, 0x68286828, 0x4a0a0a4a, 0x9c5c9c5c,
    0xc282c282, 0x004080c0, 0xfa3aba7a, 0x4a0a4a0a, 0x28282868, 0xd696d696, 0x62222262, 0xae2eae6e,
    0x54145414, 0xc888ccc8, 0xce8ece8e, 0x0c4c0c4c, 0xa262a262, 0x6a2a6a2a, 0x10501050, 0x88c888c8,
    0x04440444, 0x74347434, 0xaa2aaa6a, 0xfa3aba3a, 0x56165616, 0x5c1c5c1c, 0x00400040, 0x52125212,
    0x5616d696, 0x4a0aca8a, 0xbc7cfc3c, 0x18581858, 0x2e6e6e2e, 0x0a4a0a4a, 0x18585858, 0x4c0c8c8c,
    0x70303030, 0x2e6e2e6e, 0xc888c888, 0x6a2aea2a, 0xc484c484, 0x1e5e5e5e, 0xb2f2f2b2, 0x6e2eeeae,
    0xa060a060, 0x0c4c8c8c, 0xc6868686, 0x0e0e4e0e, 0x4c0ccc8c, 0x7a3a7a3a, 0x6c2c6c2c, 0x44040404,
    0x66262626, 0x22626222, 0x7c3c3c7c, 0xa020e020, 0x8a4aca8a, 0x58181818, 0xec6cacec, 0x42020202,
    0xf0b0f0b0, 0x94d4d494, 0x7c3cbc3c, 0x9a5ada9a, 0x561696d6, 0xa868e8a8, 0x3f3f3f7f, 0x6cacecac,
    0x5a1a9a9a, 0xc808c808, 0x2a6aea6a, 0x46064606, 0x64242424, 0x38383878, 0x9858d898, 0xba7afa3a,
    0xf070b030, 0x36763676, 0x30703070, 0x28686868, 0x14549454, 0x3e7e7e3e, 0x36367676, 0x7030b070,
    0x26266666, 0x0e0e4e4e, 0x6666a666, 0x5c1c1c1c, 0x30307070, 0x5010d090, 0x14145454, 0xb878bcbc,
    0xd4949494, 0x50101010, 0x74343434, 0x8242c282, 0x76363676, 0x6e2eae2e, 0x60202020, 0x54141414,
    0x24246464, 0x02024242, 0x3e3e7e7e, 0x32327272, 0x3a3afa7a, 0x9c5cdc9c, 0x48080808, 0xc686cece,
    0x98589858, 0x0a0a4a4a, 0x5e1ede9e, 0x04044444, 0x12125252, 0xa262e2a2, 0x4a0a8a8a, 0x68282828,
    0x38387878, 0x00004040, 0x40400000, 0x6626e666, 0x9a5ada5a, 0x06064646, 0x4e4e0e0e, 0x9e5ede9e,
    0x3e7efe7e, 0xd0d09090, 0x2a2a6a6a, 0x52929252, 0x20206060, 0x72723232, 0x08084848, 0xc4c48484
]);

const KC = new Uint32Array([
    0x9e3779b9, 0x3c6ef373, 0x78dde6e6, 0xf1bbcdcc, 0xe19754e3, 0xc32ed9a0, 0x40c8b98b, 0x81917216,
    0x0256242f, 0x04ac485e, 0x095890bc, 0x12b02078, 0x256040f0, 0x4ac081e0, 0x958002c0, 0x2b010580
]);

// Helper functions for SEED
function getB0(x: number): number { return (x & 0xff); }
function getB1(x: number): number { return ((x >>> 8) & 0xff); }
function getB2(x: number): number { return ((x >>> 16) & 0xff); }
function getB3(x: number): number { return ((x >>> 24) & 0xff); }

function g(x: number): number {
    return (SS0[getB0(x)] ^ SS1[getB1(x)] ^ SS2[getB2(x)] ^ SS3[getB3(x)]) >>> 0;
}

function ROTL(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

// Round function F
// args: K0, K1 are round keys
function f(K0: number, K1: number, R0: number, R1: number): [number, number] {
    const C = (R0 ^ K0) >>> 0;
    const D = (R1 ^ K1) >>> 0;
    const Z = (C ^ D) >>> 0;
    const t0 = g(Z);
    const t1 = (t0 + Z) >>> 0; // Addition mod 2^32
    return [g(t0), g(t1)];
}

// Generate round keys from 16-byte key
// Supports both Big Endian (Standard) and Little Endian (Coocon Variant?) key loading
function seedRoundKeys(key: Uint8Array, littleEndianKey: boolean = false): number[][] {
    const K = new Array(4);
    for (let i = 0; i < 4; i++) {
        if (littleEndianKey) {
            K[i] = ((key[i * 4 + 3] << 24) | (key[i * 4 + 2] << 16) | (key[i * 4 + 1] << 8) | key[i * 4]) >>> 0;
        } else {
            K[i] = ((key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]) >>> 0;
        }
    }

    const roundKeys: number[][] = [];

    for (let i = 0; i < 16; i++) {
        let t0, t1;
        if (i % 2 === 0) {
            t0 = ((K[0] + K[2] - KC[i]) >>> 0);
            t1 = ((K[1] - K[3] + KC[i]) >>> 0);
        } else {
            t0 = ((K[0] + K[2] + KC[i]) >>> 0);
            t1 = ((K[1] - K[3] - KC[i]) >>> 0);
        }

        const rk = [g(t0), g(t1)];
        roundKeys.push(rk);

        if (i % 2 === 0) {
            const temp = K[0];
            K[0] = ROTL(K[0], 8);
            K[0] = ((K[0] & 0xffffff00) | (K[1] >>> 24)) >>> 0;
            K[1] = ((K[1] << 8) | (temp >>> 24)) >>> 0;
        } else {
            const temp = K[3];
            K[3] = ((K[3] >>> 8) | (K[2] << 24)) >>> 0;
            K[2] = ((K[2] & 0x00ffffff) | (temp << 24)) >>> 0;
        }
    }

    return roundKeys;
}

// SEED block decryption (16 bytes)
// Supports littleEndianData param
function seedDecryptBlock(block: Uint8Array, roundKeys: number[][], littleEndianData: boolean = false): Uint8Array {
    let L: number, R: number, L1: number, R1: number;

    if (littleEndianData) {
        L = ((block[3] << 24) | (block[2] << 16) | (block[1] << 8) | block[0]) >>> 0;
        R = ((block[7] << 24) | (block[6] << 16) | (block[5] << 8) | block[4]) >>> 0;
        L1 = ((block[11] << 24) | (block[10] << 16) | (block[9] << 8) | block[8]) >>> 0;
        R1 = ((block[15] << 24) | (block[14] << 16) | (block[13] << 8) | block[12]) >>> 0;
    } else {
        L = ((block[0] << 24) | (block[1] << 16) | (block[2] << 8) | block[3]) >>> 0;
        R = ((block[4] << 24) | (block[5] << 16) | (block[6] << 8) | block[7]) >>> 0;
        L1 = ((block[8] << 24) | (block[9] << 16) | (block[10] << 8) | block[11]) >>> 0;
        R1 = ((block[12] << 24) | (block[13] << 16) | (block[14] << 8) | block[15]) >>> 0;
    }

    // Decrypt rounds in reverse order
    for (let i = 15; i >= 0; i--) {
        const [t0, t1] = f(roundKeys[i][0], roundKeys[i][1], L1, R1);
        const newL = (L ^ t0) >>> 0;
        const newR = (R ^ t1) >>> 0;
        L = L1;
        R = R1;
        L1 = newL;
        R1 = newR;
    }

    const result = new Uint8Array(16);
    // Write back. Usually we write back in same endianness as read?
    // Standard SEED outputs Big Endian bytes.
    // If data was LE, we interpret decrypted integers as LE bytes?
    // Let's assume output is always serialized as Big Endian byte stream unless caller swaps it back.
    // Actually, if we read LE, we should probably write LE back to match struct? 
    // But text string? Let's assume writes are Big Endian (Standard Network Order) for now.
    // IF result implies text string...

    // Actually, standard is: Output bytes correspond to Integers.
    // Let's write as Big Endian.
    result[0] = L1 >>> 24; result[1] = (L1 >>> 16) & 0xff; result[2] = (L1 >>> 8) & 0xff; result[3] = L1 & 0xff;
    result[4] = R1 >>> 24; result[5] = (R1 >>> 16) & 0xff; result[6] = (R1 >>> 8) & 0xff; result[7] = R1 & 0xff;
    result[8] = L >>> 24; result[9] = (L >>> 16) & 0xff; result[10] = (L >>> 8) & 0xff; result[11] = L & 0xff;
    result[12] = R >>> 24; result[13] = (R >>> 16) & 0xff; result[14] = (R >>> 8) & 0xff; result[15] = R & 0xff;

    return result;
}


// SEED-CBC decryption
export function seedCbcDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, littleEndianKey: boolean = false, littleEndianData: boolean = false): Uint8Array {
    if (ciphertext.length % 16 !== 0) {
        throw new Error("Ciphertext length must be a multiple of 16 bytes");
    }

    const roundKeys = seedRoundKeys(key, littleEndianKey);
    const plaintext = new Uint8Array(ciphertext.length);
    let previousBlock = iv;

    for (let i = 0; i < ciphertext.length; i += 16) {
        const block = ciphertext.slice(i, i + 16);
        const decrypted = seedDecryptBlock(block, roundKeys, littleEndianData);

        // XOR with previous ciphertext block (or IV)
        for (let j = 0; j < 16; j++) {
            plaintext[i + j] = decrypted[j] ^ previousBlock[j];
        }

        previousBlock = block;
    }

    // Remove PKCS7 padding
    const padLen = plaintext[plaintext.length - 1];
    if (padLen > 0 && padLen <= 16) {
        // Validate padding bytes
        let valid = true;
        for (let k = 0; k < padLen; k++) {
            if (plaintext[plaintext.length - 1 - k] !== padLen) {
                valid = false;
                break;
            }
        }
        if (valid) {
            return plaintext.slice(0, plaintext.length - padLen);
        }
    }

    return plaintext;
}

// Helper to try parsing JSON
function tryParseJson(str: string): any | null {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

// Web Crypto SHA-256 / MD5
async function computeHash(algo: "SHA-256" | "MD5", str: string): Promise<Uint8Array> {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest(algo, data);
    return new Uint8Array(hash);
}

// Hardcoded IV from ISASSeedCBC.class (0xFEDCBA9876543210 repeated)
const COOCON_IV = new Uint8Array([
    0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10,
    0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10
]);

// Reverse-engineered KDF from ISASSeedCBC.class
function deriveCooconKey(uid: string, action: string): Uint8Array {
    if (uid.length <= 12 || action.length <= 15) {
        throw new Error("Uid/Action too short for Coocon KDF");
    }

    const chars = [
        uid.charAt(10),
        action.charAt(1),
        uid.charAt(8),
        action.charAt(8),
        action.charAt(5),
        action.charAt(4),
        uid.charAt(5),
        action.charAt(15),
        uid.charAt(0),
        uid.charAt(5), // Repeated
        action.charAt(13),
        uid.charAt(11),
        uid.charAt(9),
        action.charAt(6),
        action.charAt(3),
        uid.charAt(12)
    ];

    return new TextEncoder().encode(chars.join(""));
}

const STATIC_KEY_STR = "K26FJ5Y62R2UF4Y3";

// ISASSeedCBC-compatible decrypt function (Async)
// Tries multiple key derivation strategies AND Endianness strategies
export async function isasDecrypt(base64Data: string, uid: string, action: string): Promise<any> {
    let lastError: any;

    // Extended strategies including Endianness variations
    // "Coocon" = BE Key, BE Data
    // "CooconLE" = LE Key, BE Data
    // "CooconLEData" = BE Key, LE Data
    // "CooconAllLE" = LE Key, LE Data
    const strategies = [
        "Coocon", "CooconLE", "CooconLEData", "CooconAllLE",
        "CooconSwap", "Static", "Base64", "MD5", "SHA-256", "Raw"
    ];

    // Decode ciphertext once (Assumes Base64 -> Binary String -> Bytes)
    const ciphertext = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        try {
            let keyBytes: Uint8Array;
            let ivBytes: Uint8Array = COOCON_IV;
            let littleEndianKey = false;
            let littleEndianData = false;

            // Configure strategy parameters
            if (strategy === "Coocon") {
                keyBytes = deriveCooconKey(uid, action);
            } else if (strategy === "CooconLE") {
                keyBytes = deriveCooconKey(uid, action);
                littleEndianKey = true;
            } else if (strategy === "CooconLEData") {
                keyBytes = deriveCooconKey(uid, action);
                littleEndianData = true;
            } else if (strategy === "CooconAllLE") {
                keyBytes = deriveCooconKey(uid, action);
                littleEndianKey = true;
                littleEndianData = true;
            } else if (strategy === "CooconSwap") {
                keyBytes = deriveCooconKey(action, uid);
            } else if (strategy === "Static") {
                keyBytes = new TextEncoder().encode(STATIC_KEY_STR);
            } else if (strategy === "Base64") {
                keyBytes = Uint8Array.from(atob(uid), c => c.charCodeAt(0)).slice(0, 16);
                ivBytes = Uint8Array.from(atob(action), c => c.charCodeAt(0)).slice(0, 16);
            } else if (strategy === "MD5") {
                keyBytes = (await computeHash("MD5", uid)).slice(0, 16);
                ivBytes = (await computeHash("MD5", action)).slice(0, 16);
            } else if (strategy === "SHA-256") {
                keyBytes = (await computeHash("SHA-256", uid)).slice(0, 16);
                ivBytes = (await computeHash("SHA-256", action)).slice(0, 16);
            } else { // Raw
                keyBytes = new TextEncoder().encode(uid).slice(0, 16);
                ivBytes = new TextEncoder().encode(action).slice(0, 16);
            }

            if (keyBytes.length < 16 || ivBytes.length < 16) continue;

            // Try Decryption
            const plaintext = seedCbcDecrypt(ciphertext, keyBytes, ivBytes, littleEndianKey, littleEndianData);
            const decoded = new TextDecoder().decode(plaintext);

            // Verify if it looks like JSON
            if (decoded.trim().startsWith("{") || decoded.trim().startsWith("[")) {
                const jsonObj = tryParseJson(decoded);
                if (jsonObj) {
                    console.log(`[isasDecrypt] Success with strategy: ${strategy}`);
                    return jsonObj;
                }
            }

            // Keep errors for logging
            lastError = new Error(`Strategy ${strategy} produced invalid JSON: ${decoded.substring(0, 50)}...`);
        } catch (e: any) {
            lastError = e;
            // Continue
        }
    }

    console.error("[isasDecrypt] All strategies failed. Last error:", lastError);
    return null; // Return null if all failed
}
