import { splitTeams, type SplitInput } from "./teamSplit";

// 팀 나누기 경우의 수는 메인 스레드에서 돌리면 화면이 멈춰서 따로 계산한다 (TonightPage의 useTeamSplits)
self.onmessage = (e: MessageEvent<SplitInput>) => {
  self.postMessage(splitTeams(e.data));
};
