
import { useEffect, useState } from 'react'

const API_BASE_URL = 'http://127.0.0.1:8000'

const getImageUrl = (path) => {
  if (!path) return null

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const formattedPath = path.replace(/\\/g, '/').replace(/^\/+/, '')

  return `${API_BASE_URL}/${formattedPath}`
}

const formatScore = (score) => {
  if (typeof score !== 'number') return 'N/A'
  return `${(score * 100).toFixed(2)}%`
}

function MySubmissions({ onPrevious }) {
  const [savedSubmissions, setSavedSubmissions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [moderationResults, setModerationResults] = useState({})

  useEffect(() => {
    let isActive = true

    const fetchSubmissions = async () => {
      setIsLoading(true)
      setFetchError('')

      try {
        const response = await fetch(`${API_BASE_URL}/submissions`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error('Unable to retrieve submissions')
        }

        const sortedSubmissions = [...result].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )

        if (!isActive) return

        setSavedSubmissions(sortedSubmissions)

        // New: Give every submission an initial Pending status.
        const initialResults = {}

        sortedSubmissions.forEach((submission) => {
          initialResults[submission.id] = {
            status: 'pending',
            images: []
          }
        })

        setModerationResults(initialResults)

        // New: Fetch moderation results separately for each submission.
        sortedSubmissions.forEach(async (submission) => {
          try {
            const moderationResponse = await fetch(
              `${API_BASE_URL}/submissions/${submission.id}/moderation-results`
            )

            const moderationData = await moderationResponse.json()

            if (!moderationResponse.ok) {
              throw new Error('Unable to retrieve moderation results')
            }

            if (!isActive) return

            setModerationResults((previousResults) => ({
              ...previousResults,
              [submission.id]: moderationData
            }))
          } catch (error) {
            if (!isActive) return

            setModerationResults((previousResults) => ({
              ...previousResults,
              [submission.id]: {
                status: 'unavailable',
                error: error.message,
                images: []
              }
            }))
          }
        })

      } catch (error) {
        if (isActive) {
          setFetchError(error.message || 'Something went wrong')
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    fetchSubmissions()

    return () => {
      isActive = false
    }
  }, [])

  const imageStyle = {
    width: '150px',
    height: '150px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid #ddd',
    padding: '5px',
    backgroundColor: '#fff',
    cursor: 'pointer'
  }

  const previewImage = (path, alt) => (
    <img
      src={getImageUrl(path)}
      alt={alt}
      style={imageStyle}
      onClick={() =>
        setSelectedImage({
          url: getImageUrl(path),
          alt: alt
        })
      }
    />
  )

  const renderModerationResults = (submissionId) => {
    const result = moderationResults[submissionId]

    if (!result || result.status === 'pending' || result.status === 'processing') {
      return (
        <div style={{ marginTop: '25px' }}>
          <h3>AI Moderation Results</h3>
          <p>
            Processing Status: <strong>{result?.status || 'Pending'}</strong>
          </p>
          <p>AI analysis is still running. Please refresh this page later.</p>
        </div>
      )
    }

    if (result.status === 'failed' || result.status === 'unavailable') {
      return (
        <div style={{ marginTop: '25px' }}>
          <h3>AI Moderation Results</h3>
          <p style={{ color: 'red' }}>
            Processing Status: {result.status}
          </p>
          <p>{result.error_message || result.error || 'Unable to retrieve results.'}</p>
        </div>
      )
    }

    if (result.status !== 'completed') {
      return (
        <div style={{ marginTop: '25px' }}>
          <h3>AI Moderation Results</h3>
          <p>Processing Status: {result.status}</p>
        </div>
      )
    }

    const detoxifyScores = result.detoxify_scores || {}
    const images = result.images || []

    return (
      <div style={{ marginTop: '25px' }}>
        <hr />

        <h3>AI Moderation Results</h3>

        <p>
          <strong>Processing Status:</strong>{' '}
          <span style={{ color: 'green', fontWeight: 'bold' }}>
            Completed
          </span>
        </p>

        <p>
          <strong>Detoxify Model:</strong> {result.detoxify_model || 'N/A'}
        </p>

        <h4>1. Text Moderation (Detoxify)</h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          {[
            'toxicity',
            'severe_toxicity',
            'obscene',
            'threat',
            'insult',
            'identity_attack'
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px'
              }}
            >
              <strong>{label.replaceAll('_', ' ')}</strong>
              <p style={{ marginBottom: 0 }}>
                {formatScore(detoxifyScores[label])}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '15px' }}>
          <p><strong>Original Text:</strong></p>
          <p>{result.original_text || 'No original text available.'}</p>

          <p><strong>Combined OCR Text:</strong></p>
          <p>{result.combined_ocr_text || 'No OCR text available.'}</p>
        </div>

        <hr />

        <h4>2. Extracted Image Text (OCR)</h4>

        {images.length > 0 ? (
          images.map((image) => (
            <div
              key={image.id}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                marginBottom: '12px'
              }}
            >
              <strong>
                {image.image_type.replaceAll('_', ' ')}
              </strong>
              <p>
                {image.extracted_text || 'No text detected in this image.'}
              </p>
            </div>
          ))
        ) : (
          <p>No image OCR results available.</p>
        )}

        <hr />

        <h4>3. Image Moderation (NSFW Detection)</h4>

        {images.length > 0 ? (
          images.map((image) => (
            <div
              key={image.id}
              style={{
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                marginBottom: '15px'
              }}
            >
              <h5>{image.image_type.replaceAll('_', ' ')}</h5>

              <p>
                <strong>Model:</strong> {image.nsfw_model || 'N/A'}
              </p>

              {(image.nsfw_scores || []).map((score) => (
                <p key={score.label}>
                  <strong>{score.label}:</strong> {formatScore(score.score)}
                </p>
              ))}
            </div>
          ))
        ) : (
          <p>No image moderation results available.</p>
        )}
      </div>
    )
  }

  return (
    <div className="main-section review-page">

      <h1 className="review-title">My Submissions</h1>

      <p className="review-description">
        View your previously submitted content and AI moderation results.
      </p>

      {isLoading && (
        <div className="form-card review-card">
          <p>Loading submissions...</p>
        </div>
      )}

      {fetchError && (
        <div className="form-card review-card">
          <p style={{ color: 'red' }}>
            Error: {fetchError}
          </p>
        </div>
      )}

      {!isLoading && !fetchError && savedSubmissions.length === 0 && (
        <div className="form-card review-card">
          <p>No saved submissions found.</p>
        </div>
      )}

      {!isLoading && !fetchError && savedSubmissions.map(submission => (
        <div
          key={submission.id}
          className="form-card review-card"
          style={{
            marginBottom: '25px',
            padding: '25px',
            border: '1px solid #ddd',
            borderRadius: '12px'
          }}
        >

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h2>Submission #{submission.id}</h2>

            <span style={{
              backgroundColor: '#e8f0fe',
              color: '#2457a7',
              padding: '7px 12px',
              borderRadius: '20px',
              fontSize: '13px'
            }}>
              Submitted
            </span>
          </div>

          <p>
            <strong>Submitted On:</strong>{' '}
            {new Date(submission.created_at).toLocaleString()}
          </p>

          <hr />

          <h3>Content Information</h3>

          <p><strong>Content Title:</strong> {submission.contentTitle}</p>
          <p><strong>Category:</strong> {submission.category}</p>
          <p><strong>Language:</strong> {submission.language}</p>
          <p><strong>Content Source:</strong> {submission.contentSource}</p>
          <p><strong>Description:</strong> {submission.description}</p>

          <hr />

          <h3>Uploaded Images</h3>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '25px',
            marginTop: '15px'
          }}>

            <div>
              <p><strong>Basic Information Image</strong></p>

              {submission.basic_info_image ? (
                previewImage(
                  submission.basic_info_image,
                  'Basic Information'
                )
              ) : (
                <p>No image uploaded</p>
              )}
            </div>

            <div>
              <p><strong>App Icon</strong></p>

              {submission.app_icon ? (
                previewImage(submission.app_icon, 'App Icon')
              ) : (
                <p>No app icon uploaded</p>
              )}
            </div>

          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Screenshots</h3>

            {(submission.screenshots || []).length > 0 ? (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '20px'
              }}>
                {submission.screenshots.map((path, index) => (
                  <div key={index}>
                    <p>Screenshot {index + 1}</p>

                    {previewImage(
                      path,
                      `Screenshot ${index + 1}`
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No screenshots uploaded</p>
            )}
          </div>

          {renderModerationResults(submission.id)}

        </div>
      ))}

      <div className="form-buttons review-buttons">
        <button
          type="button"
          className="previous-btn"
          onClick={onPrevious}
        >
          Previous
        </button>
      </div>

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '30px',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>

          <img
            src={selectedImage.url}
            alt={selectedImage.alt}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '90%',
              maxHeight: '85%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
        </div>
      )}

    </div>
  )
}

export default MySubmissions
