import { parseDocumentItem, rebaseAssetUrls } from '@vm/shared'
import type { DocumentIndexItem, DocumentItem } from '@vm/shared'
import { CONTENT_SOURCE, documentUrlsForId, fetchFirstJson } from './source.js'

const cache = new Map<string, DocumentItem>()

export async function fetchDocumentDetail(index: DocumentIndexItem): Promise<DocumentItem> {
  const cached = cache.get(index.id)
  if (cached) return cached
  const item = await fetchFirstJson(documentUrlsForId(index.documentKey), (raw) => parseDocumentItem(
    rebaseAssetUrls(raw, { assetBaseUrl: CONTENT_SOURCE.assetBaseUrl, appBaseUrl: CONTENT_SOURCE.appBaseUrl, assetVersion: CONTENT_SOURCE.assetVersion }),
  )) as DocumentItem
  cache.set(index.id, item)
  return item
}

export async function fetchDocumentDetails(documents: DocumentIndexItem[]): Promise<DocumentItem[]> {
  return Promise.all(documents.map((document) => fetchDocumentDetail(document)))
}
