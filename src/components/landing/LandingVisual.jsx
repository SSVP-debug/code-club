/**
 * Optional landing-page imagery.
 *
 * Visuals intentionally have no hard card/border treatment. When an image is
 * supplied, it dissolves into the landing background through CSS masking and
 * layered gradients. When src is absent, the reserved visual space remains
 * quiet and borderless so the section still has a deliberate composition.
 *
 * Keep this component presentational: it owns image treatment only, not
 * sourcing, loading, or page content.
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
