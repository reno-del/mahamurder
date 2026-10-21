// 고른 후보의 상세 정보를 읽는다(텀블벅 선물 가격·소개글, 머미나우·보드라이프 상세).
// 사용: node detail.mjs tumblbug <permalink...> | murmynow <goodsNo...> | boardlife <id...>
import { args } from "./lib.mjs";
import { details, pool } from "./sources.mjs";

const [site, ...ids] = args()._;
if (!details[site] || !ids.length) {
  console.error("사용: node detail.mjs <tumblbug|murmynow|boardlife> <id...>");
  process.exit(1);
}
console.log(JSON.stringify(await pool(ids, 3, (id) => details[site](id)), null, 1));
