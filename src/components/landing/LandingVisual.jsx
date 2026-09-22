/**
 * Optional landing-page imagery.
 *
 * Images are treated as atmospheric layers rather than cards. The caller can
 * control the focal point so people/faces stay inside the frame when the
 * viewport crops a source image.
 */
function LandingVisual({
  src,
  alt = "",
  className = "",
  position = "center",
  priority = false,
}) {
  const positionClass = {
    left: "object-left",
    center: "object-center",
    right: "object-right",
    top: "object-top",
  }[position] ?? "object-center";

  return (
    <div
      aria-hidden={alt ? undefined : true}
      className={[
        "lp-visual relative min-h-[240px] w-full overflow-hidden md:min-h-[340px]",
        className,
      ].join(" ")}
    >
      {src ? (
        <>
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className={`lp-visual-image absolute inset-0 h-full w-full object-cover ${positionClass}`}
          />
          <div className="lp-visual-fade absolute inset-0" aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}

export default LandingVisual;
