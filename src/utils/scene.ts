async function* animate(
  element: HTMLElement,
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
  animationOptions?: KeyframeAnimationOptions
) {
  const options: KeyframeAnimationOptions = {
    duration: 2000,
    fill: "forwards",
    easing: "ease-in-out",
    ...animationOptions,
  };
  const animation = element.animate(keyframes, options);
  await animation.finished;

  yield;
}
