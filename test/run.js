// 单进程聚合入口 —— node --test 默认每个测试文件各开一个子进程，
// Windows 上进程启动/杀软扫描开销大；聚合后只有本文件一个子进程。
// 新增测试文件后记得在这里补一行 import。
import './utils.test.js';
import './insight.test.js';
import './character.test.js';
import './profile.test.js';
import './memory.test.js';
import './theme.test.js';
import './dom.test.js';
import './selector-gen.test.js';
import './role-diff.test.js';
import './platform-config.test.js';
