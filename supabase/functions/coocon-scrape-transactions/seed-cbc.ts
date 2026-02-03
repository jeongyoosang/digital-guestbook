// SEED-CBC Implementation for Coocon decryption
// Based on KISA SEED specification

// SEED S-boxes
const SS0: number[] = [
    0x2989a1a8, 0x05858184, 0x16c6d2d4, 0x13c3d1d0, 0x14445054, 0x1d0d111c, 0x2c8ca0ac, 0x25052124,
    0x1d4d515c, 0x03434340, 0x18081018, 0x1e0e121c, 0x11415150, 0x3cccf0fc, 0x0acac2c8, 0x23436360,
    0x28082028, 0x04444044, 0x20002020, 0x1d8d919c, 0x20c0e0e0, 0x22c2e2e0, 0x08c8c0c8, 0x17071314,
    0x2585a1a4, 0x0f8f838c, 0x03030300, 0x3b4b7378, 0x3b8bb3b8, 0x13031110, 0x12c2d0d0, 0x2ecee2ec,
    0x30407070, 0x0c8c808c, 0x3f0f333c, 0x2888a0a8, 0x32023230, 0x1dcdd1dc, 0x36c6f2f4, 0x34447074,
    0x2ccce0ec, 0x15859194, 0x0b0b0308, 0x17475354, 0x1c4c505c, 0x1b4b5358, 0x3d8db1bc, 0x01010100,
    0x24042024, 0x1c0c101c, 0x33437370, 0x18889098, 0x10001010, 0x0cccc0cc, 0x32c2f0f0, 0x19c9d1d8,
    0x2c0c202c, 0x27c7e3e4, 0x32427270, 0x03838380, 0x1b8b9398, 0x11c1d1d0, 0x06868284, 0x09c9c1c8,
    0x20406060, 0x10405050, 0x2383a3a0, 0x2bcbe3e8, 0x0d0d010c, 0x3686b2b4, 0x1e8e929c, 0x0f4f434c,
    0x3787b3b4, 0x1a4a5258, 0x06c6c2c4, 0x38487078, 0x2686a2a4, 0x12021210, 0x2f8fa3ac, 0x15c5d1d4,
    0x21416160, 0x03c3c3c0, 0x3484b0b4, 0x01414140, 0x12425250, 0x3d4d717c, 0x0d8d818c, 0x08080008,
    0x1f0f131c, 0x19899198, 0x00000000, 0x19091118, 0x04040004, 0x13435350, 0x37c7f3f4, 0x21c1e1e0,
    0x3dcdf1fc, 0x36467274, 0x2f0f232c, 0x27072324, 0x3080b0b0, 0x0b8b8388, 0x0e0e020c, 0x2b8ba3a8,
    0x2282a2a0, 0x2e4e626c, 0x13839390, 0x0d4d414c, 0x29496168, 0x3c4c707c, 0x09090108, 0x0a0a0208,
    0x3f8fb3bc, 0x2fcfe3ec, 0x33c3f3f0, 0x05c5c1c4, 0x07878384, 0x14041014, 0x3ecef2fc, 0x24446064,
    0x1eced2dc, 0x2e0e222c, 0x0b4b4348, 0x1a0a1218, 0x06060204, 0x21012120, 0x2b4b6368, 0x26466264,
    0x02020200, 0x35c5f1f4, 0x12829290, 0x0a8a8288, 0x0c0c000c, 0x3383b3b0, 0x3e4e727c, 0x10c0d0d0,
    0x3a4a7278, 0x07474344, 0x16869294, 0x25c5e1e4, 0x26062224, 0x00808080, 0x2d8da1ac, 0x1fcfd3dc,
    0x2181a1a0, 0x30003030, 0x37073334, 0x2e8ea2ac, 0x36063234, 0x15051114, 0x22022220, 0x38083038,
    0x34c4f0f4, 0x2787a3a4, 0x05454144, 0x0c4c404c, 0x01818180, 0x29c9e1e8, 0x04848084, 0x17879394,
    0x35053134, 0x0bcbc3c8, 0x0ecec2cc, 0x3c0c303c, 0x31417170, 0x11011110, 0x07c7c3c4, 0x09898188,
    0x35457174, 0x3bcbf3f8, 0x1acad2d8, 0x38c8f0f8, 0x14849094, 0x19495158, 0x02828280, 0x04c4c0c4,
    0x3fcff3fc, 0x09494148, 0x39093138, 0x27476364, 0x00c0c0c0, 0x0fcfc3cc, 0x17c7d3d4, 0x3888b0b8,
    0x0f0f030c, 0x0e8e828c, 0x02424240, 0x23032320, 0x11819190, 0x2c4c606c, 0x1bcbd3d8, 0x2484a0a4,
    0x34043034, 0x31c1f1f0, 0x08484048, 0x02c2c2c0, 0x2f4f636c, 0x3d0d313c, 0x2d0d212c, 0x00404040,
    0x3e8eb2bc, 0x3e0e323c, 0x3c8cb0bc, 0x01c1c1c0, 0x2a8aa2a8, 0x3a8ab2b8, 0x0e4e424c, 0x15455154,
    0x3b0b3338, 0x1cccd0dc, 0x28486068, 0x3f4f737c, 0x1c8c909c, 0x18c8d0d8, 0x0a4a4248, 0x16465254,
    0x37477374, 0x2080a0a0, 0x2dcde1ec, 0x06464244, 0x3585b1b4, 0x2b0b2328, 0x25456164, 0x3acaf2f8,
    0x23c3e3e0, 0x3989b1b8, 0x3181b1b0, 0x1f8f939c, 0x1e4e525c, 0x39c9f1f8, 0x26c6e2e4, 0x3282b2b0,
    0x31013130, 0x2acae2e8, 0x2d4d616c, 0x1f4f535c, 0x24c4e0e4, 0x30c0f0f0, 0x0dcdc1cc, 0x08888088,
    0x16061214, 0x3a0a3238, 0x18485058, 0x14c4d0d4, 0x22426260, 0x29092128, 0x07070304, 0x33033330,
    0x28c8e0e8, 0x1b0b1318, 0x05050104, 0x39497178, 0x10809090, 0x2a4a6268, 0x2a0a2228, 0x1a8a9298
];

const SS1: number[] = [
    0x38380830, 0xe828c8e0, 0x2c2d0d21, 0xa42686a2, 0xcc0fcfc3, 0xdc1eced2, 0xb03383b3, 0xb83888b0,
    0xac2f8fa3, 0x60204060, 0x54154551, 0xc407c7c3, 0x44044440, 0x6c2f4f63, 0x682b4b63, 0x581b4b53,
    0xc003c3c3, 0x60224262, 0x30330333, 0xb43585b1, 0x28290921, 0xa02080a0, 0xe022c2e2, 0xa42787a3,
    0xd013c3d3, 0x90118191, 0x10110111, 0x04060602, 0x1c1c0c10, 0xbc3c8cb0, 0x34360632, 0x480b4b43,
    0xec2fcfe3, 0x88088880, 0x6c2c4c60, 0xa82888a0, 0x14170713, 0xc404c4c0, 0x14160612, 0xf434c4f0,
    0xc002c2c2, 0x44054541, 0xe021c1e1, 0xd416c6d2, 0x3c3f0f33, 0x3c3d0d31, 0x8c0e8e82, 0x98188890,
    0x28280820, 0x4c0e4e42, 0xf436c6f2, 0x3c3e0e32, 0xa42585a1, 0xf839c9f1, 0x0c0d0d01, 0xdc1fcfd3,
    0xd818c8d0, 0x282b0b23, 0x64264662, 0x783a4a72, 0x24270723, 0x2c2f0f23, 0xf031c1f1, 0x70324272,
    0x40024242, 0xd414c4d0, 0x40014141, 0xc000c0c0, 0x70334373, 0x64274763, 0xac2c8ca0, 0x880b8b83,
    0xf437c7f3, 0xac2d8da1, 0x80008080, 0x1c1f0f13, 0xc80acac2, 0x2c2c0c20, 0xa82a8aa2, 0x34340430,
    0xd012c2d2, 0x080b0b03, 0xec2ecee2, 0xe829c9e1, 0x5c1d4d51, 0x94148490, 0x18180810, 0xf838c8f0,
    0x54174753, 0xac2e8ea2, 0x08080800, 0xc405c5c1, 0x10130313, 0xcc0dcdc1, 0x84068682, 0xb83989b1,
    0xfc3fcff3, 0x7c3d4d71, 0xc001c1c1, 0x30310131, 0xf435c5f1, 0x880a8a82, 0x682a4a62, 0xb03181b1,
    0xd011c1d1, 0x20200020, 0xd417c7d3, 0x00020202, 0x20220222, 0x04040400, 0x68284860, 0x70314171,
    0x04050501, 0xd81bcbd3, 0x9c1d8d91, 0x98198991, 0x60214161, 0xbc3e8eb2, 0xe426c6e2, 0x58194951,
    0xdc1dcdd1, 0x50114151, 0x90108090, 0xdc1cccd0, 0x981a8a92, 0xa02383a3, 0xa82b8ba3, 0xd010c0d0,
    0x80018181, 0x0c0f0f03, 0x44074743, 0x181a0a12, 0xe023c3e3, 0xec2ccce0, 0x8c0d8d81, 0xbc3f8fb3,
    0x94168692, 0x783b4b73, 0x5c1c4c50, 0xa02282a2, 0xa02181a1, 0x60234363, 0x20230323, 0x4c0d4d41,
    0xc80bcbc3, 0xf030c0f0, 0x8c0c8c80, 0x28270723, 0x10110011, 0x30310031, 0x04070703, 0x9c1c8c90,
    0x906090a0, 0x28260622, 0x64264460, 0x84058581, 0xcc0dccc0, 0x8c0c8080, 0x98198881, 0x50104150,
    0x70304070, 0x38390931, 0xf032c2f2, 0xcc0dccc1, 0x8c0c8c81, 0x98198890, 0x78394971, 0x30200030,
    0xe425c5e1, 0x88098981, 0xcc0fcfc2, 0x14160712, 0xfc3ecef2, 0x7c3c4c70, 0x70304270, 0xdc1eccd2,
    0x84078783, 0x300f0f3f, 0x90118090, 0x18190911, 0x68294961, 0x80018080, 0x88088888, 0x7c3d4d70,
    0x74364672, 0x3c3c0c30, 0x78384870, 0x28250521, 0x2c2e0e22, 0x58184850, 0x40034343, 0x30230323,
    0x28200020, 0xec2fcff3, 0x9c1d8d91, 0x94178793, 0x20200020, 0xe425c4e0, 0x8c0f8f83, 0xe828c8e0,
    0x5c1f4f53, 0x00030303, 0x78394b73, 0xb83b8bb3, 0x10130011, 0xd012c0d0, 0xec2eece2, 0x70404030,
    0x0c0c8080, 0x3c3f0f3c, 0xa82880a0, 0x30023230, 0xdc1dccd0, 0xf436c4f0, 0x74344474, 0xec2cc0ec,
    0x94159495, 0x0b030008, 0x54175357, 0x1c1c4c50, 0x1b4b5b58, 0xbc3d81bc, 0x00010101, 0x24042420,
    0x1c0c1c10, 0x33437373, 0x98188098, 0x10001010, 0xcc0cc0cc, 0xf032c0f0, 0xd819c1d8, 0x2c0c2c20,
    0xe427c3e4, 0x32427072, 0x80038083, 0x1b8b9b98, 0xd011c1d0, 0x84068286, 0xc809c1c8, 0x60204060,
    0x50104050, 0xa023a3a0, 0xe82bc3e8, 0x0d0d010c, 0xb63686b2, 0x9e1e8e92, 0x4f0f434c, 0xb737b3b4,
    0x5a1a4a52, 0xc606c2c4, 0x78384870, 0xa62686a2, 0x12021012, 0xaf2f8fa3, 0xd515c1d4, 0x61214160
];

const SS2: number[] = [
    0x6c6c0048, 0xc3c3c000, 0xb4b40438, 0x41414140, 0x52425012, 0x7d7d4d3c, 0x8d8d0188, 0x08080800,
    0x1f1f0f1c, 0x99919118, 0x00000000, 0x19191910, 0x04040400, 0x53435310, 0xf7f7c3f4, 0xe1e1c1e0,
    0xfdfdf1fd, 0x74746472, 0x2f2f0f2c, 0x27272324, 0xb0b08030, 0x8b8b0388, 0x0e0e020c, 0xaba3a3a8,
    0xa2a2a2a0, 0x6e6e424c, 0x93939310, 0x4d4d410c, 0x69696128, 0x7c7c403c, 0x09090108, 0x0a0a0208,
    0xbfbfb3bc, 0xefefe3ec, 0xf3f3c3f0, 0xc5c5c1c4, 0x87878384, 0x14141014, 0xfefef2fc, 0x64646460,
    0xdeded2dc, 0x2e2e222c, 0x4b4b4348, 0x1a1a1218, 0x06060204, 0x21212120, 0x6b6b6368, 0x66666264,
    0x02020200, 0xf5f5c1f4, 0x92929290, 0x8a8a0288, 0x0c0c000c, 0xb3b3b3b0, 0x7e7e423c, 0xd0d0c0d0,
    0x7a7a4238, 0x47474344, 0x96969294, 0xe5e5c1e4, 0x26262224, 0x80808080, 0xadada1ac, 0xdfdfd3dc,
    0xa1a1a1a0, 0x30003030, 0x37373334, 0xaeaea2ac, 0x36363234, 0x15151114, 0x22222220, 0x38083038,
    0xf4f4c0f4, 0xa7a7a3a4, 0x45454144, 0x4c4c400c, 0x81818180, 0xe9e9c1e8, 0x84848084, 0x97979394,
    0x35353134, 0xcbcbc3c8, 0xcecec2cc, 0x3c0c303c, 0x71714130, 0x11111110, 0xc7c7c3c4, 0x89898188,
    0x75754534, 0xfbfbf3f8, 0xdadad2d8, 0xf8f8c0f8, 0x94949094, 0x59595158, 0x82828280, 0xc4c4c0c4,
    0xfffff3fc, 0x49494148, 0x39393138, 0x67676364, 0xc0c0c0c0, 0xcfcfc3cc, 0xd7d7c3d4, 0xb8b880b8,
    0x0f0f030c, 0x8e8e028c, 0x42424240, 0x23232320, 0x91919190, 0x6c6c604c, 0xdbdbd3d8, 0xa4a4a0a4,
    0x34043034, 0xf1f1c1f0, 0x48484048, 0xc2c2c2c0, 0x6f6f636c, 0x3d0d313c, 0x2d0d212c, 0x40404040,
    0xbebeb2bc, 0x3e0e323c, 0xbcbcb0bc, 0xc1c1c1c0, 0xaaa2a2a8, 0xbab2b2b8, 0x4e4e424c, 0x55555154,
    0x3b0b3338, 0xdcdcd0dc, 0x68686068, 0x7f7f733c, 0x9c9c909c, 0xd8d8c0d8, 0x4a4a4248, 0x56565254,
    0x77777374, 0xa0a0a0a0, 0xedede1ec, 0x46464244, 0xb5b5b1b4, 0x2b0b2328, 0x65656164, 0xfafaf2f8,
    0xe3e3c3e0, 0xb9b9b1b8, 0xb1b1b1b0, 0x9f9f939c, 0x5e5e525c, 0xf9f9f1f8, 0xe6e6e2e4, 0xb2b2b2b0,
    0x31013130, 0xeaeae2e8, 0x6d6d616c, 0x5f5f535c, 0xe4e4e0e4, 0xf0f0c0f0, 0xcdcdc1cc, 0x88888088,
    0x16161214, 0x3a0a3238, 0x58585058, 0xd4d4c0d4, 0x62626260, 0x29092128, 0x07070304, 0x33033330,
    0xe8e8c0e8, 0x1b0b1318, 0x05050104, 0x79797178, 0x90909090, 0x6a6a6268, 0x2a0a2228, 0x9a9a9298
];

const SS3: number[] = [
    0x38380830, 0xe8e8c0e0, 0x2d2d0d21, 0xa6a686a2, 0xcfcfc3c3, 0xdeded2d2, 0xb3b3b3b3, 0xb8b8b0b0,
    0xafafa3a3, 0x60604060, 0x55555151, 0xc7c7c3c3, 0x44444040, 0x6f6f4363, 0x6b6b4363, 0x5b5b5353,
    0xc3c3c3c3, 0x62624262, 0x33333333, 0xb5b585b1, 0x29290921, 0xa0a080a0, 0xe2e2c2e2, 0xa7a787a3,
    0xd3d3c3d3, 0x91918191, 0x11111111, 0x06060602, 0x1c1c0c10, 0xbcbc8cb0, 0x36360632, 0x4b4b4343,
    0xefefe3e3, 0x88888080, 0x6c6c4c60, 0xa8a888a0, 0x17170713, 0xc4c4c0c0, 0x16160612, 0xf4f4c0f0,
    0xc2c2c2c2, 0x45454141, 0xe1e1c1e1, 0xd6d6c2d2, 0x3f3f0f33, 0x3d3d0d31, 0x8e8e8282, 0x98988090,
    0x28280820, 0x4e4e4242, 0xf6f6c2f2, 0x3e3e0e32, 0xa5a585a1, 0xf9f9c1f1, 0x0d0d0d01, 0xdfdfd3d3,
    0xd8d8c0d0, 0x2b2b0b23, 0x66664662, 0x7a7a4a72, 0x27270723, 0x2f2f0f23, 0xf1f1c1f1, 0x72724272,
    0x42424242, 0xd4d4c0d0, 0x41414141, 0xc0c0c0c0, 0x73734373, 0x67674763, 0xacac8ca0, 0x8b8b8383,
    0xf7f7c3f3, 0xadad8da1, 0x80808080, 0x1f1f0f13, 0xcacac2c2, 0x2c2c0c20, 0xaaaa8aa2, 0x34340430,
    0xd2d2c2d2, 0x0b0b0b03, 0xeeeec2e2, 0xe9e9c1e1, 0x5d5d4d51, 0x94948490, 0x18180810, 0xf8f8c0f0,
    0x57574753, 0xaeae8ea2, 0x08080800, 0xc5c5c1c1, 0x13130313, 0xcdcdc1c1, 0x86868682, 0xb9b989b1,
    0xffffc3f3, 0x7d7d4d71, 0xc1c1c1c1, 0x31310131, 0xf5f5c1f1, 0x8a8a8282, 0x6a6a4a62, 0xb1b181b1,
    0xd1d1c1d1, 0x20200020, 0xd7d7c3d3, 0x02020202, 0x22220222, 0x04040400, 0x68684860, 0x71714171,
    0x05050501, 0xdbdbc3d3, 0x9d9d8d91, 0x99998991, 0x61614161, 0xbebe8eb2, 0xe6e6c2e2, 0x59594951,
    0xddddcdcd, 0x51514151, 0x90908090, 0xdcdcccd0, 0x9a9a8a92, 0xa3a383a3, 0xabab8ba3, 0xd0d0c0d0,
    0x81818181, 0x0f0f0f03, 0x47474743, 0x1a1a0a12, 0xe3e3c3e3, 0xececc0e0, 0x8d8d8181, 0xbfbf8fb3,
    0x96968692, 0x7b7b4b73, 0x5c5c4c50, 0xa2a282a2, 0xa1a181a1, 0x63634363, 0x23230323, 0x4d4d4141,
    0xcbcbc3c3, 0xf0f0c0f0, 0x8c8c8c80, 0x27230723, 0x11110011, 0x31310031, 0x07070703, 0x9c9c8c90,
    0x90609020, 0x26220622, 0x64644460, 0x85858181, 0xcdcdccc0, 0x8c8c8080, 0x99988181, 0x51504050,
    0x70304030, 0x39390931, 0xf2f2c2f2, 0xcdcdccc1, 0x8c8c8c81, 0x99988890, 0x79794971, 0x30200030,
    0xe5e5c1e1, 0x89898181, 0xcfcfc3c2, 0x16160712, 0xfefec2f2, 0x7c7c4c70, 0x70704070, 0xdede8cd2,
    0x87878783, 0x0f0f3f03, 0x91908090, 0x19190911, 0x69694961, 0x80808080, 0x88888888, 0x7d7d4d70,
    0x74744672, 0x3c3c0c30, 0x78784870, 0x25250521, 0x2e2e0e22, 0x58584850, 0x43434343, 0x23230323,
    0x28200020, 0xefefc3f3, 0x9d9d8d91, 0x97979793, 0x20200020, 0xe5e4c0e0, 0x8f8f8383, 0xe8e8c0e0,
    0x5f5f4f53, 0x03030303, 0x79794b73, 0xbbbb8bb3, 0x13130011, 0xd2d0c0d0, 0xeeeec2e2, 0x40703040,
    0x0c0c8080, 0x3f3f0f3c, 0xa8a880a0, 0x32302030, 0xddddccd0, 0xf6f4c0f0, 0x74744474, 0xececc0ec,
    0x95949194, 0x0b030008, 0x57575357, 0x1c1c4c50, 0x5b5b5b58, 0xbdbdb1bc, 0x01010100, 0x24242420
];

// SEED round keys generation helper functions
function getB0(x: number): number { return (x & 0xff); }
function getB1(x: number): number { return ((x >>> 8) & 0xff); }
function getB2(x: number): number { return ((x >>> 16) & 0xff); }
function getB3(x: number): number { return ((x >>> 24) & 0xff); }

function ROTL(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function g(x: number): number {
    return (SS0[getB0(x)] ^ SS1[getB1(x)] ^ SS2[getB2(x)] ^ SS3[getB3(x)]) >>> 0;
}

function f(k0: number, k1: number, r0: number, r1: number): [number, number] {
    let t0 = ((r0 ^ k0) >>> 0);
    let t1 = ((r1 ^ k1) >>> 0);
    t1 = ((t1 ^ t0) >>> 0);
    t1 = g(t1);
    t0 = ((t0 + t1) >>> 0);
    t0 = g(t0);
    t1 = ((t1 + t0) >>> 0);
    t1 = g(t1);
    t0 = ((t0 + t1) >>> 0);
    return [t0, t1];
}

// Key constants
const KC: number[] = [
    0x9e3779b9, 0x3c6ef373, 0x78dde6e6, 0xf1bbcdcc, 0xe3779b99, 0xc6ef3733, 0x8dde6e67, 0x1bbcdccf,
    0x3779b99e, 0x6ef3733c, 0xdde6e678, 0xbbcdccf1, 0x779b99e3, 0xef3733c6, 0xde6e678d, 0xbcdccf1b
];

// Generate round keys from 16-byte key
function seedRoundKeys(key: Uint8Array, littleEndianKey: boolean = false): number[][] {
    const K = new Array(4);
    for (let i = 0; i < 4; i++) {
        if (littleEndianKey) {
            // Little Endian Key Loading
            K[i] = ((key[i * 4 + 3] << 24) | (key[i * 4 + 2] << 16) | (key[i * 4 + 1] << 8) | key[i * 4]) >>> 0;
        } else {
            // Big Endian Key Loading (Standard)
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
function seedDecryptBlock(block: Uint8Array, roundKeys: number[][]): Uint8Array {
    // Data is always Big Endian in SEED usually, but allow checking?
    // Assume Standard Data Loading (Big Endian)
    let L = ((block[0] << 24) | (block[1] << 16) | (block[2] << 8) | block[3]) >>> 0;
    let R = ((block[4] << 24) | (block[5] << 16) | (block[6] << 8) | block[7]) >>> 0;
    let L1 = ((block[8] << 24) | (block[9] << 16) | (block[10] << 8) | block[11]) >>> 0;
    let R1 = ((block[12] << 24) | (block[13] << 16) | (block[14] << 8) | block[15]) >>> 0;

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
    // Write back Big Endian
    result[0] = L1 >>> 24; result[1] = (L1 >>> 16) & 0xff; result[2] = (L1 >>> 8) & 0xff; result[3] = L1 & 0xff;
    result[4] = R1 >>> 24; result[5] = (R1 >>> 16) & 0xff; result[6] = (R1 >>> 8) & 0xff; result[7] = R1 & 0xff;
    result[8] = L >>> 24; result[9] = (L >>> 16) & 0xff; result[10] = (L >>> 8) & 0xff; result[11] = L & 0xff;
    result[12] = R >>> 24; result[13] = (R >>> 16) & 0xff; result[14] = (R >>> 8) & 0xff; result[15] = R & 0xff;

    return result;
}

// SEED-CBC decryption
export function seedCbcDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, littleEndianKey: boolean = false): Uint8Array {
    if (ciphertext.length % 16 !== 0) {
        throw new Error("Ciphertext length must be a multiple of 16 bytes");
    }

    const roundKeys = seedRoundKeys(key, littleEndianKey);
    const plaintext = new Uint8Array(ciphertext.length);
    let previousBlock = iv;

    for (let i = 0; i < ciphertext.length; i += 16) {
        const block = ciphertext.slice(i, i + 16);
        const decrypted = seedDecryptBlock(block, roundKeys);

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

// Compute Hash using Web Crypto API
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
// Picks 16 chars from Uid and Action at specific indices
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

// Hardcoded Key from ISASSeedCBC.class (for decrypt(data) method)
const STATIC_KEY_STR = "K26FJ5Y62R2UF4Y3";

// ISASSeedCBC-compatible decrypt function (Async)
// Tries multiple key derivation strategies
export async function isasDecrypt(base64Data: string, uid: string, action: string): Promise<string> {
    let lastError: any;
    // Put Coocon strategy first as it's the reverse-engineered one
    // Added "CooconLE" strategy (Little Endian Key)
    const strategies = ["Coocon", "CooconLE", "CooconSwap", "Static", "Base64", "MD5", "SHA-256", "Raw"];

    // Decode ciphertext once
    const ciphertext = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        let keyBytes: Uint8Array;
        let ivBytes: Uint8Array = COOCON_IV;
        let littleEndianKey = false;

        try {
            if (strategy === "Coocon") {
                keyBytes = deriveCooconKey(uid, action);
            } else if (strategy === "CooconLE") {
                keyBytes = deriveCooconKey(uid, action);
                littleEndianKey = true;
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

            // Log key for debugging (first 4 bytes hex)
            const keyHex = Array.from(keyBytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
            // console.log(`[isasDecrypt] Strategy ${strategy} Key Prefix: ${keyHex}`);

            const plaintext = seedCbcDecrypt(ciphertext, keyBytes, ivBytes, littleEndianKey);
            const decoded = new TextDecoder().decode(plaintext);

            // Verify if it looks like JSON
            // Valid Coocon result usually starts with { "ResultList": ... } or { "List": ... }
            if (decoded.trim().startsWith("{") || decoded.trim().startsWith("[")) {
                // Determine if valid JSON
                if (tryParseJson(decoded)) {
                    console.log(`[isasDecrypt] Success with strategy: ${strategy}`);
                    return decoded;
                }
            }

            // Keep errors for logging
            lastError = new Error(`Strategy ${strategy} produced invalid JSON: ${decoded.substring(0, 50)}...`);
        } catch (e: any) {
            lastError = e;
            // Continue to next strategy
        }
    }

    throw lastError || new Error("All decryption strategies failed");
}
