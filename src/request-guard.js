/* =====================================================================
 * 请求守卫 —— 统一"序号防竞态 + 可中止请求"的流程模式
 * 三个 flow（建议/角色卡/记忆）共用，替代各自重复的 seq/request 簿记
 * ===================================================================== */

export function createRequestGuard() {
  let seq = 0;
  let request = null;

  return {
    // 是否有在途请求（卸载/切栈判断用）
    isBusy() { return !!request; },

    // 使在途请求作废并中止：序号自增后，旧 handle 的 stale() 恒为真
    cancel() {
      seq++;
      const active = request;
      request = null;
      if (active && typeof active.abort === 'function') active.abort();
    },

    // 登记一次新请求；返回 handle.stale() 判断结果是否已被更新的一轮取代，
    // handle.done() 在 finally 里清掉在途引用（仅当仍是最新一代）
    track(promise) {
      const mySeq = ++seq;
      request = promise;
      return {
        stale() { return mySeq !== seq; },
        done() { if (mySeq === seq) request = null; },
      };
    },
  };
}
