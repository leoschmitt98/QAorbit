function readFileNameFromDisposition(header: string | null, fallbackTicketId: string) {
  if (!header) {
    return `evidencia-${fallbackTicketId}.docx`
  }

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const basicMatch = header.match(/filename="?([^"]+)"?/i)
  return basicMatch?.[1] || `evidencia-${fallbackTicketId}.docx`
}

export async function downloadEvidenceDocx(ticketId: string) {
  const response = await fetch(`/api/evidencias/${encodeURIComponent(ticketId)}/export-docx`)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message || 'Nao foi possivel gerar o arquivo Word.')
  }

  const blob = await response.blob()
  if (!blob.size) {
    throw new Error('O arquivo Word foi gerado vazio. Tente novamente.')
  }

  const fileName = readFileNameFromDisposition(response.headers.get('content-disposition'), ticketId)
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url)
  }, 30_000)

  return {
    fileName,
    blobSize: blob.size,
    serverCopyUrl: `/storage/chamados/${encodeURIComponent(ticketId)}/${encodeURIComponent(fileName)}`,
  }
}
