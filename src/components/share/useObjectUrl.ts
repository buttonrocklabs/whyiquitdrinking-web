import { useLayoutEffect, useState } from 'react'

/**
 * A blob URL for a file, revoked when the file changes or the component unmounts. Made in
 * a layout effect so the image has its source before the first paint. The URL is returned
 * only while it belongs to the file passed in, so a revoked one is never handed out.
 */
export function useObjectUrl(file: File | null): string | null {
  const [made, setMade] = useState<{ file: File; url: string } | null>(null)

  useLayoutEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    // The blob URL registry is the external system here, so the effect owns creating it.
    // oxlint-disable-next-line react/set-state-in-effect
    setMade({ file, url })
    return () => URL.revokeObjectURL(url)
  }, [file])

  return file && made?.file === file ? made.url : null
}
