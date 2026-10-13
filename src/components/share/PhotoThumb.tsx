import { useObjectUrl } from './useObjectUrl'

/** A small framed preview of a photo file. The size and shape come from the caller's className. */
export default function PhotoThumb({ file, className = '' }: { file: File | null; className?: string }) {
  const url = useObjectUrl(file)
  if (!url) return <span className={`block bg-line ${className}`} aria-hidden="true" />
  return <img src={url} alt="" className={`block object-cover ${className}`} />
}
