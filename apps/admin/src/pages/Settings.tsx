import { useState, useRef, useMemo } from 'react'
import { useDraftStore } from '../store.js'
import { uploadFile, saveDraft, checkApi } from '../api.js'
import { resizeImage } from '../util/imageResize.js'
import { resolveDocumentImageVariantUrl } from '@vm/shared'

const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

interface LogItem {
  id: string
  text: string
  type: 'info' | 'success' | 'error'
}

export function Settings() {
  const content = useDraftStore((s) => s.content)
  const updateSettings = useDraftStore((s) => s.updateSettings)
  const markClean = useDraftStore((s) => s.markClean)

  // Settings form states
  const [thumb, setThumb] = useState<string | number>(content?.settings?.imageRescale?.thumb ?? 360)
  const [wall, setWall] = useState<string | number>(content?.settings?.imageRescale?.wall ?? 1200)
  const [full, setFull] = useState<string | number>(content?.settings?.imageRescale?.full ?? 4096)

  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  // Rescale tool states
  const [running, setRunning] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [totalImages, setTotalImages] = useState(0)
  const [currentItemName, setCurrentItemName] = useState('')
  const [logs, setLogs] = useState<LogItem[]>([])
  const [errorCount, setErrorCount] = useState(0)
  const [successCount, setSuccessCount] = useState(0)

  // Selected variants for rescaling
  const [rescaleThumb, setRescaleThumb] = useState(false)
  const [rescaleWall, setRescaleWall] = useState(false)
  const [rescaleFull, setRescaleFull] = useState(false)

  const cancelRef = useRef(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  if (!content) {
    return <div style={styles.center}>Đang tải cấu hình...</div>
  }

  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs((prev) => [
      ...prev,
      { id: `log-${Date.now()}-${Math.random()}`, text, type },
    ])
    // Scroll to bottom
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    }, 50)
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveStatus(null)
    try {
      const finalThumb = Math.max(100, Number(thumb)) || 360
      const finalWall = Math.max(200, Number(wall)) || 1200
      const finalFull = Math.max(400, Number(full)) || 4096

      setThumb(finalThumb)
      setWall(finalWall)
      setFull(finalFull)

      const nextSettings = {
        imageRescale: {
          thumb: finalThumb,
          wall: finalWall,
          full: finalFull,
        },
      }
      updateSettings(nextSettings)
      
      // Save directly to the worker R2 draft
      const updatedContent = {
        ...content,
        settings: nextSettings,
      }
      await saveDraft(updatedContent)
      markClean()
      
      setSaveStatus('Lưu cấu hình thành công!')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      setSaveStatus(`Lỗi khi lưu: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // Quét toàn bộ ảnh raw để tạo danh sách cần rescale
  const rescaleList = useMemo(() => {
    const list: {
      documentKey: string
      imageId: string
      rawExt: string
      caption: string
      docTitle: string
    }[] = []

    content.documents.forEach((doc) => {
      // Chỉ rescale các tài liệu có chứa ảnh
      if (doc.mediaType === 'image' || (doc.images && doc.images.length > 0)) {
        doc.images.forEach((img) => {
          list.push({
            documentKey: doc.documentKey,
            imageId: img.id,
            rawExt: img.rawExt || 'jpg',
            caption: img.caption || img.id,
            docTitle: doc.title,
          })
        })
      }
    })
    return list
  }, [content.documents])

  const handleStartRescale = async () => {
    if (rescaleList.length === 0) {
      alert('Không có ảnh nào trong thư viện để rescale.')
      return
    }

    if (!rescaleThumb && !rescaleWall && !rescaleFull) {
      alert('Vui lòng chọn ít nhất một loại ảnh để thực hiện nén (rescale).')
      return
    }

    const selectedVariants: string[] = []
    if (rescaleThumb) selectedVariants.push(`Thumbnail (${thumb}px)`)
    if (rescaleWall) selectedVariants.push(`Ảnh treo tường (${wall}px)`)
    if (rescaleFull) selectedVariants.push(`Ảnh phóng to (${full}px)`)

    const confirmStart = confirm(
      `Hệ thống sẽ tải lần lượt ${rescaleList.length} ảnh gốc từ R2 về trình duyệt, nén lại theo cấu hình đã chọn:\n- ${selectedVariants.join('\n- ')}\nrồi upload đè lên R2.\n\nBạn có chắc chắn muốn bắt đầu?`
    )
    if (!confirmStart) return

    setRunning(true)
    cancelRef.current = false
    setCurrentIdx(0)
    setTotalImages(rescaleList.length)
    setErrorCount(0)
    setSuccessCount(0)
    setLogs([])

    addLog('Bắt đầu tiến trình Rescale hàng loạt...', 'info')
    addLog(`Tìm thấy tổng cộng ${rescaleList.length} ảnh cần xử lý.`, 'info')
    addLog(`Cấu hình lựa chọn: ${selectedVariants.join(', ')}`, 'info')

    const apiAvailable = await checkApi()
    if (!apiAvailable) {
      addLog('✕ Lỗi: Không thể kết nối tới Worker API. Hãy kiểm tra kết nối mạng/VPN.', 'error')
      setRunning(false)
      return
    }

    for (let i = 0; i < rescaleList.length; i++) {
      if (cancelRef.current) {
        addLog(' Tiến trình đã bị hủy bởi người dùng.', 'error')
        break
      }

      const item = rescaleList[i]!
      setCurrentIdx(i)
      setCurrentItemName(`${item.docTitle} (${item.caption})`)
      addLog(`[${i + 1}/${rescaleList.length}] Đang xử lý: ${item.docTitle} - ảnh ${item.caption}...`, 'info')

      const rawUrl = resolveDocumentImageVariantUrl(
        item.documentKey,
        item.imageId,
        'raw',
        { assetBaseUrl: ASSET_BASE_URL, assetVersion: import.meta.env.VITE_ASSET_VERSION ?? '' },
        item.rawExt
      )

      if (!rawUrl) {
        addLog(`✕ Lỗi: Không thể tạo URL ảnh gốc cho ${item.caption}`, 'error')
        setErrorCount((prev) => prev + 1)
        continue
      }

      try {
        // 1. Tải ảnh gốc
        const response = await fetch(rawUrl)
        if (!response.ok) {
          throw new Error(`Tải raw thất bại (HTTP ${response.status})`)
        }
        const blob = await response.blob()
        const file = new File([blob], `raw.${item.rawExt}`, { type: blob.type })

        // 2. Resize ảnh theo settings hiện tại
        const config = {
          thumb: Number(thumb) || 360,
          wall: Number(wall) || 1200,
          full: Number(full) || 4096,
        }
        const variants = await resizeImage(file, config, {
          thumb: rescaleThumb,
          wall: rescaleWall,
          full: rescaleFull,
        })

        // 3. Upload đè lên R2 các bản WebP đã chọn
        const uploadPromises = []
        if (rescaleThumb && variants.thumb) {
          uploadPromises.push(uploadFile(variants.thumb, `content/documents/${item.documentKey}/images/${item.imageId}/thumb.webp`))
        }
        if (rescaleWall && variants.wall) {
          uploadPromises.push(uploadFile(variants.wall, `content/documents/${item.documentKey}/images/${item.imageId}/wall.webp`))
        }
        if (rescaleFull && variants.full) {
          uploadPromises.push(uploadFile(variants.full, `content/documents/${item.documentKey}/images/${item.imageId}/full.webp`))
        }
        await Promise.all(uploadPromises)

        setSuccessCount((prev) => prev + 1)
        addLog(`✓ Thành công: Ghi đè các bản WebP cho ${item.caption}`, 'success')
      } catch (err) {
        setErrorCount((prev) => prev + 1)
        addLog(`✕ Thất bại: ${String(err)}`, 'error')
      }

      // Giãn cách một chút giữa các request để tránh nghẽn
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    setRunning(false)
    setCurrentItemName('')
    addLog('----------------------------------------------------', 'info')
    if (cancelRef.current) {
      addLog('Tiến trình dừng đột ngột do yêu cầu hủy.', 'error')
    } else {
      addLog(`Hoàn tất! Thành công: ${successCount + (cancelRef.current ? 0 : 0)} | Thất bại: ${errorCount}.`, 'info')
      addLog('LƯU Ý: Vui lòng vào màn hình "Xuất bản" và bấm "Publish" để cập nhật dữ liệu public chính thức.', 'success')
    }
  }

  const handleCancelRescale = () => {
    cancelRef.current = true
    addLog('Đang yêu cầu hủy tiến trình, vui lòng chờ xử lý nốt ảnh hiện tại...', 'info')
  }

  const progressPct = totalImages > 0 ? Math.round((currentIdx / totalImages) * 100) : 0

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h1 style={styles.title}>Cấu hình hình ảnh</h1>
        <p style={styles.sub}>Thiết lập kích thước nén ảnh tự động và tối ưu hóa tài nguyên hệ thống</p>
      </div>

      <div style={styles.contentGrid}>
        {/* Form settings */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Kích thước nén ảnh tối đa</span>
          </div>
          <form onSubmit={handleSaveSettings} style={styles.form}>
            <div style={styles.infoBox}>
              <span style={{ marginRight: '6px' }}>💡</span>
              Mặc định của hệ thống là 1200px đối với ảnh tường (Wall). Bạn có thể hạ xuống <b>600px - 800px</b> để tối ưu hóa bộ nhớ GPU, giảm giật lag trên thiết bị di động.
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Ảnh Thumbnail thư viện (Thumb)</label>
              <div style={styles.inputContainer}>
                <input
                  type="number"
                  style={styles.input}
                  value={thumb}
                  onChange={(e) => {
                    setThumb(e.target.value)
                    setRescaleThumb(true)
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value)
                    setThumb(isNaN(val) || val <= 0 ? 100 : Math.max(100, val))
                  }}
                  required
                  disabled={running || saving}
                />
                <span style={styles.unit}>px (width)</span>
              </div>
              <p style={styles.desc}>Dùng để hiển thị lưới ảnh thu nhỏ trong trang thư viện Admin/Web.</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Ảnh treo trên tường 3D (Wall)</label>
              <div style={styles.inputContainer}>
                <input
                  type="number"
                  style={styles.input}
                  value={wall}
                  onChange={(e) => {
                    setWall(e.target.value)
                    setRescaleWall(true)
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value)
                    setWall(isNaN(val) || val <= 0 ? 200 : Math.max(200, val))
                  }}
                  required
                  disabled={running || saving}
                />
                <span style={styles.unit}>px (width)</span>
              </div>
              <p style={styles.desc}>Dùng làm texture dán trực tiếp lên tường 3D trong bảo tàng. Tác động lớn nhất tới VRAM GPU.</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Ảnh khi phóng to / Modal (Full)</label>
              <div style={styles.inputContainer}>
                <input
                  type="number"
                  style={styles.input}
                  value={full}
                  onChange={(e) => {
                    setFull(e.target.value)
                    setRescaleFull(true)
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value)
                    setFull(isNaN(val) || val <= 0 ? 400 : Math.max(400, val))
                  }}
                  required
                  disabled={running || saving}
                />
                <span style={styles.unit}>px (width)</span>
              </div>
              <p style={styles.desc}>Dùng hiển thị ảnh gốc chất lượng cao khi người dùng click vào tranh để xem chi tiết.</p>
            </div>

            {saveStatus && (
              <div style={{
                ...styles.statusText,
                color: saveStatus.startsWith('Lỗi') ? '#c85a5a' : '#c8a85a'
              }}>
                {saveStatus}
              </div>
            )}

            <button
              type="submit"
              style={{
                ...styles.submitBtn,
                opacity: saving || running ? 0.6 : 1,
                cursor: saving || running ? 'not-allowed' : 'pointer'
              }}
              disabled={saving || running}
            >
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </form>
        </div>

        {/* Tool Rescale */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Tối ưu hóa ảnh hàng loạt (Rescale Tool)</span>
          </div>
          <div style={styles.form}>
            <p style={{ fontSize: '13px', color: '#9a9080', lineHeight: '1.6' }}>
              Công cụ này giúp quét tất cả ảnh gốc (raw) đã được lưu trên Cloudflare R2, nén lại theo cấu hình lựa chọn bên dưới và cập nhật đè lên các bản cũ.
            </p>

            <div style={styles.checkboxGroupTitle}>Chọn loại ảnh muốn nén (rescale):</div>
            <div style={styles.checkboxContainer}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rescaleThumb}
                  onChange={(e) => setRescaleThumb(e.target.checked)}
                  disabled={running}
                  style={styles.checkbox}
                />
                <span>Ảnh Thumbnail thư viện (Thumb - {thumb}px)</span>
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rescaleWall}
                  onChange={(e) => setRescaleWall(e.target.checked)}
                  disabled={running}
                  style={styles.checkbox}
                />
                <span>Ảnh treo trên tường 3D (Wall - {wall}px)</span>
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rescaleFull}
                  onChange={(e) => setRescaleFull(e.target.checked)}
                  disabled={running}
                  style={styles.checkbox}
                />
                <span>Ảnh phóng to / Modal (Full - {full}px)</span>
              </label>
            </div>

            <div style={styles.statsPanel}>
              <div style={styles.statItem}>
                <span style={styles.statVal}>{rescaleList.length}</span>
                <span style={styles.statLabel}>Tổng số ảnh</span>
              </div>
              <div style={styles.statItem}>
                <span style={{ ...styles.statVal, color: '#5ac85a' }}>{successCount}</span>
                <span style={styles.statLabel}>Thành công</span>
              </div>
              <div style={styles.statItem}>
                <span style={{ ...styles.statVal, color: '#c85a5a' }}>{errorCount}</span>
                <span style={styles.statLabel}>Thất bại</span>
              </div>
            </div>

            {running && (
              <div style={styles.progressContainer}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>Đang xử lý: {currentItemName}</span>
                  <span style={styles.progressValue}>{progressPct}%</span>
                </div>
                <div style={styles.progressBarBg}>
                  <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            <div style={styles.btnRow}>
              {!running ? (
                <button
                  type="button"
                  onClick={handleStartRescale}
                  style={styles.startBtn}
                >
                  ⚡ Bắt đầu Rescale hàng loạt
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelRescale}
                  style={styles.cancelBtn}
                >
                  🛑 Dừng tiến trình
                </button>
              )}
            </div>

            {/* Terminal Logs */}
            <div style={styles.logHeader}>Nhật ký xử lý:</div>
            <div ref={logContainerRef} style={styles.logBox}>
              {logs.length === 0 && (
                <div style={{ color: '#555', fontStyle: 'italic' }}>Chưa có hoạt động nào...</div>
              )}
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    ...styles.logLine,
                    color: log.type === 'success' ? '#5ac85a' : log.type === 'error' ? '#c85a5a' : '#aaa'
                  }}
                >
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#c8a85a',
    margin: 0,
  },
  sub: {
    fontSize: '13px',
    color: '#6a5a40',
    marginTop: '4px',
    margin: 0,
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    color: '#c8a85a',
    fontSize: '15px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '24px',
  },
  card: {
    background: '#0d0906',
    border: '1px solid #2a1e10',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #2a1e10',
    background: 'rgba(200, 168, 90, 0.03)',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#c8a85a',
  },
  form: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  infoBox: {
    background: 'rgba(200, 168, 90, 0.06)',
    border: '1px dashed #4a3a20',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '12px',
    color: '#9a9080',
    lineHeight: '1.5',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#9a9080',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  input: {
    background: '#140f0a',
    border: '1px solid #2a1e10',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '14px',
    flex: 1,
    outline: 'none',
  },
  unit: {
    fontSize: '12px',
    color: '#6a5a40',
    whiteSpace: 'nowrap',
  },
  desc: {
    fontSize: '11px',
    color: '#5a4a30',
    margin: 0,
  },
  submitBtn: {
    background: '#c8a85a',
    color: '#0a0804',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 700,
    alignSelf: 'flex-start',
    transition: 'all 0.15s',
  },
  statusText: {
    fontSize: '12px',
    marginTop: '4px',
  },
  statsPanel: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    background: '#140f0a',
    border: '1px solid #2a1e10',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statVal: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#c8a85a',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6a5a40',
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#9a9080',
  },
  progressLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '80%',
  },
  progressValue: {
    fontWeight: 700,
    color: '#c8a85a',
  },
  progressBarBg: {
    height: '6px',
    background: '#140f0a',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: '#c8a85a',
    borderRadius: '3px',
    transition: 'width 0.2s ease',
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
  },
  startBtn: {
    background: '#1a4f1a',
    color: '#8be58b',
    border: '1px solid #2d732d',
    borderRadius: '6px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    flex: 1,
  },
  cancelBtn: {
    background: '#4a1a1a',
    color: '#e58b8b',
    border: '1px solid #732d2d',
    borderRadius: '6px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    flex: 1,
  },
  logHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#9a9080',
    marginBottom: '-12px',
  },
  logBox: {
    background: '#070503',
    border: '1px solid #1a140d',
    borderRadius: '6px',
    padding: '12px',
    height: '160px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  logLine: {
    wordBreak: 'break-all',
    lineHeight: '1.4',
  },
  checkboxGroupTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#9a9080',
    marginTop: '10px',
  },
  checkboxContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#140f0a',
    border: '1px solid #2a1e10',
    borderRadius: '8px',
    padding: '12px 14px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#aaa',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#c8a85a',
    cursor: 'pointer',
  },
}
