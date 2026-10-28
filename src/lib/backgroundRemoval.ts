let removerPromise: Promise<(image: string) => Promise<Blob>> | null = null

/** Remove a photo's background locally in the browser. */
export async function removeImageBackground(image: Blob): Promise<Blob> {
  if (!removerPromise) {
    removerPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers')
      const removeBackground = await pipeline(
        'background-removal',
        'onnx-community/ormbg-ONNX',
        { dtype: 'q8' },
      )

      return async (imageUrl: string) => {
        const result = await removeBackground(imageUrl)
        const transparentPng = await result.toBlob('image/png')
        if (!transparentPng || transparentPng.type !== 'image/png') {
          throw new Error('Background removal did not return a transparent PNG.')
        }
        return transparentPng
      }
    })().catch((error) => {
      removerPromise = null
      throw error
    })
  }

  const removeBackground = await removerPromise
  const imageUrl = URL.createObjectURL(image)
  try {
    return await removeBackground(imageUrl)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
