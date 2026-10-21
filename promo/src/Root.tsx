import { Composition } from "remotion";
import { Promo } from "./Promo";
import T from "./timing.json";

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={T.total} fps={T.fps} width={1920} height={1080} />
);
