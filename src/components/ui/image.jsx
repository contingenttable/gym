import * as React from "react"
import { useSize } from "@/hooks/use-size"
import { cn } from "@/lib/utils"

const FALLBACK_IMAGE_URL =
  "https://static.wixstatic.com/media/12d367_4f26ccd17f8f4e3a8958306ea08c2332~mv2.png"

// Wix Media Platform hosts whose images support /v1/ transform URLs
const WIX_MEDIA_HOSTS = ["media.db.com", "static.wixstatic.com"]
const DEFAULT_TRANSFORM_WIDTH = 1024
const DEVICE_PIXEL_RATIOS = [1, 2, 3]
const MAX_DIMENSION = 6000

function parseWixMediaUrl(src) {
  try {
    const url = new URL(src)
    if (!WIX_MEDIA_HOSTS.includes(url.hostname)) return null
    const v1 = url.pathname.indexOf("/v1/")
    const basePath = v1 === -1 ? url.pathname : url.pathname.slice(0, v1)
    if (basePath.endsWith(".svg")) return null
    return { origin: url.origin, basePath }
  } catch {
    return null
  }
}

function buildWixTransformUrl(origin, basePath, width, height, fittingType) {
  const w = Math.min(width, MAX_DIMENSION)
  const h = height ? Math.min(height, MAX_DIMENSION) : Math.round(w * 0.75)
  const fit = fittingType === "fill" ? "fill" : "fit"
  return `${origin}${basePath}/v1/${fit}/w_${w},h_${h}/file.webp`
}

/**
 * <Image> — drop-in for <img> with optional Wix CDN transform.
 * Falls back gracefully for non-Wix images.
 */
const Image = React.forwardRef(function Image(
  {
    src,
    alt = "",
    fittingType = "fit",
    className,
    style,
    width: widthProp,
    height: heightProp,
    ...props
  },
  ref
) {
  const containerRef = React.useRef(null)
  const size = useSize(containerRef)

  const resolvedSrc = React.useMemo(() => {
    const s = src || FALLBACK_IMAGE_URL
    const parsed = parseWixMediaUrl(s)
    if (!parsed) return s
    const containerWidth =
      size?.width ||
      (typeof widthProp === "number" ? widthProp : DEFAULT_TRANSFORM_WIDTH)
    const containerHeight =
      size?.height || (typeof heightProp === "number" ? heightProp : undefined)
    return buildWixTransformUrl(
      parsed.origin,
      parsed.basePath,
      containerWidth,
      containerHeight,
      fittingType
    )
  }, [src, size, widthProp, heightProp, fittingType])

  const srcSet = React.useMemo(() => {
    const s = src || FALLBACK_IMAGE_URL
    const parsed = parseWixMediaUrl(s)
    if (!parsed) return undefined
    const baseWidth =
      size?.width ||
      (typeof widthProp === "number" ? widthProp : DEFAULT_TRANSFORM_WIDTH)
    return DEVICE_PIXEL_RATIOS.map((dpr) => {
      const w = Math.min(Math.round(baseWidth * dpr), MAX_DIMENSION)
      const url = buildWixTransformUrl(
        parsed.origin,
        parsed.basePath,
        w,
        undefined,
        fittingType
      )
      return `${url} ${dpr}x`
    }).join(", ")
  }, [src, size, widthProp, fittingType])

  return (
    <span ref={containerRef} className={cn("inline-block", className)} style={style}>
      <img
        ref={ref}
        src={resolvedSrc}
        srcSet={srcSet}
        alt={alt}
        width={widthProp}
        height={heightProp}
        className="w-full h-full object-cover"
        {...props}
      />
    </span>
  )
})

Image.displayName = "Image"

export { Image }
