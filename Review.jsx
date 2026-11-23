
import { useEffect, useState } from 'react'

function Review({
  basicInfo,
  appDetails,
  onEditBasic,
  onEditApp,
  onPrevious,
  onSubmit
}) {
  const [basicImagePreview, setBasicImagePreview] = useState(null)
  const [appIconPreview, setAppIconPreview] = useState(null)

  // Create image previews
  useEffect(() => {
    if (!basicInfo.appIcon) {
      setBasicImagePreview(null)
      return
    }

    const url = URL.createObjectURL(basicInfo.appIcon)
    setBasicImagePreview(url)

    return () => URL.revokeObjectURL(url)
  }, [basicInfo.appIcon])

  useEffect(() => {
    if (!appDetails.appIcon) {
      setAppIconPreview(null)
      return
    }

    const url = URL.createObjectURL(appDetails.appIcon)
    setAppIconPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [appDetails.appIcon])

  const basicInfoCompleted =
    basicInfo.contentTitle &&
    basicInfo.category &&
    basicInfo.language &&
    basicInfo.contentSource &&
    basicInfo.description

  const appDetailsCompleted =
    appDetails.appIcon &&
    appDetails.screenshots?.length > 0

  return (
    <div className="main-section review-page">

      <h1 className="review-title">Review Submission</h1>
      <p className="review-description">
        Please review your information before submitting.
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

  <div className="step active">
    <div className="step-circle">3</div>
    <div className="step-text">
      <h4>Review</h4>
      <p>Review your submission</p>
    </div>
  </div>

  <div className="progress-line"></div>

  <div className="step">
    <div className="step-circle">4</div>
    <div className="step-text">
      <h4>Submit</h4>
      <p>Submit for screening</p>
    </div>
  </div>
</div>

      {/* Basic Information */}
      <div className="form-card review-card">

        <div className="review-section-header">
          <h2>Basic Information</h2>

          <button
            type="button"
            className="review-edit-btn"
            onClick={onEditBasic}
          >
            Edit
          </button>
        </div>

        <div className="review-details">
          <p><strong>Content Title:</strong> {basicInfo.contentTitle || '-'}</p>
          <p><strong>Category:</strong> {basicInfo.category || '-'}</p>
          <p><strong>Language:</strong> {basicInfo.language || '-'}</p>
          <p><strong>Content Source:</strong> {basicInfo.contentSource || '-'}</p>
          <p><strong>Description:</strong> {basicInfo.description || '-'}</p>
        </div>

        {basicImagePreview && (
          <div className="review-image">
            <p><strong>Uploaded Image:</strong></p>
            <img
              src={basicImagePreview}
              alt="Uploaded content"
              width="150"
            />
          </div>
        )}

      </div>

      {/* App Details */}
      <div className="form-card review-card">

        <div className="review-section-header">
          <h2>App Details</h2>

          <button
            type="button"
            className="review-edit-btn"
            onClick={onEditApp}
          >
            Edit
          </button>
        </div>

        <div className="review-image">
          <p><strong>App Icon:</strong></p>

          {appIconPreview && (
            <img
              src={appIconPreview}
              alt="App Icon"
              width="100"
            />
          )}
        </div>

        <div className="review-details">
          <p>
            <strong>Screenshots:</strong>{' '}
            {appDetails.screenshots?.length || 0} / 8 uploaded
          </p>

          {appDetails.screenshots?.map((screenshot, index) => (
            <p key={index}>
              {index + 1}. {screenshot.name}
            </p>
          ))}
        </div>

      </div>

      {/* Submission Checklist */}
      <div className="form-card review-card">

        <h2>Submission Checklist</h2>

        <ul className="review-checklist">
          <li>
            <span>{basicInfoCompleted ? '✓' : '○'}</span>
            Basic Information
            <strong>{basicInfoCompleted ? 'Completed' : 'Incomplete'}</strong>
          </li>

          <li>
            <span>{appDetailsCompleted ? '✓' : '○'}</span>
            App Details
            <strong>{appDetailsCompleted ? 'Completed' : 'Incomplete'}</strong>
          </li>

          <li>
            <span>○</span>
            Final Submission
            <strong>Pending</strong>
          </li>
        </ul>

      </div>

      {/* Bottom Navigation */}
      <div className="form-buttons review-buttons">

        <button
          type="button"
          className="previous-btn"
          onClick={onPrevious}
        >
          Previous
        </button>

        <button
          type="button"
          className="next-btn"
          disabled={!basicInfoCompleted || !appDetailsCompleted}
          onClick={onSubmit}
        >
          Submit
        </button>

      </div>

    </div>
  )
}

export default Review
