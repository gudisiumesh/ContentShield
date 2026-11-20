
import { useState } from 'react'

function SubmissionResults({ basicInfo, appDetails, onPrevious, onNext }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionMessage, setSubmissionMessage] = useState('')
  const [submissionError, setSubmissionError] = useState('')
  const [submissionId, setSubmissionId] = useState(null)

  // Submit content to FastAPI
  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmissionMessage('')
    setSubmissionError('')
    setSubmissionId(null)

    try {
      const formData = new FormData()

      // Add text fields
      formData.append('contentTitle', basicInfo.contentTitle || '')
      formData.append('category', basicInfo.category || '')
      formData.append('language', basicInfo.language || '')
      formData.append('contentSource', basicInfo.contentSource || '')
      formData.append('description', basicInfo.description || '')

      // Add Basic Information image
      if (basicInfo.appIcon) {
        formData.append('basic_info_image', basicInfo.appIcon)
      }

      // Add App Icon
      if (appDetails.appIcon) {
        formData.append('app_icon', appDetails.appIcon)
      }

      // Add screenshots
      ;(appDetails.screenshots || []).forEach(file => {
        formData.append('screenshots', file)
      })

      // Send data to FastAPI
      const response = await fetch(
        'http://127.0.0.1:8000/submissions',
        {
          method: 'POST',
          body: formData
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.detail
            ? JSON.stringify(result.detail)
            : 'Submission failed'
        )
      }

      setSubmissionMessage(
        result.message || 'Submission successful!'
      )

      setSubmissionId(
        result.submission_id ?? result.id ?? null
      )

    } catch (error) {
      setSubmissionError(
        error.message || 'Something went wrong'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="main-section review-page">

      <h1 className="review-title">Submit Content</h1>

      <p className="review-description">
        Submit your content for AI moderation.
        You can view the moderation results in My Submissions.
      </p>
      {/* Progress Indicator */}
<div className="progress-container">
  <div className="step completed">
    <div className="step-circle">1</div>
    <div className="step-text">
      <h4>Basic Information</h4>
      <p>Enter content details</p>
    </div>
  </div>

  <div className="progress-line"></div>

  <div className="step completed">
    <div className="step-circle">2</div>
    <div className="step-text">
      <h4>App Details</h4>
      <p>Upload application assets</p>
    </div>
  </div>

  <div className="progress-line"></div>

  <div className="step completed">
    <div className="step-circle">3</div>
    <div className="step-text">
      <h4>Review</h4>
      <p>Review your submission</p>
    </div>
  </div>

  <div className="progress-line"></div>

  <div className="step active">
    <div className="step-circle">4</div>
    <div className="step-text">
      <h4>Submit</h4>
      <p>Submit for screening</p>
    </div>
  </div>
</div>

      <div className="form-card review-card">

        {!submissionMessage && !submissionError && (
          <>
            <h2>Ready to Submit</h2>
            <p>
              Click Submit to save your content information
              and uploaded files.
            </p>
          </>
        )}

        {isSubmitting && (
          <p>Submitting your information...</p>
        )}

        {submissionMessage && (
          <div>
            <h2>Submission Successful!</h2>

            <p style={{ color: 'green' }}>
              {submissionMessage}
            </p>

            {submissionId !== null && (
              <p>
                <strong>Submission ID:</strong> {submissionId}
              </p>
            )}

            <p>
              Your content has been submitted.
              You can check its AI moderation results
              in My Submissions.
            </p>
          </div>
        )}

        {submissionError && (
          <div>
            <h2>Submission Failed</h2>

            <p style={{ color: 'red' }}>
              Error: {submissionError}
            </p>
          </div>
        )}

      </div>

      <div className="form-buttons review-buttons">

        {!submissionMessage && (
          <>
            <button
              type="button"
              className="previous-btn"
              onClick={onPrevious}
              disabled={isSubmitting}
            >
              Previous
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </>
        )}

        {submissionMessage && (
          <button
            type="button"
            className="next-btn"
            onClick={onNext}
          >
            Next
          </button>
        )}

      </div>

    </div>
  )
}

export default SubmissionResults
