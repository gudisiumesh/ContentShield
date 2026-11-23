
import { useState, useRef, useEffect } from 'react'

function AppDetails({ basicInfo, appDetails, onPrevious, onNext, onSave }) {
  const [appIcon, setAppIcon] = useState(appDetails.appIcon || null)
  const [iconPreview, setIconPreview] = useState(null)
  const [screenshots, setScreenshots] = useState(appDetails.screenshots || [])

  const iconInputRef = useRef(null)
  const screenshotsInputRef = useRef(null)

  // Update the data stored in App.jsx
  const updateAppDetails = (field, value) => {
    onSave(previous => ({
      ...previous,
      [field]: value
    }))
  }

  // Create preview for the selected app icon
  useEffect(() => {
    if (!appIcon) {
      setIconPreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(appIcon)
    setIconPreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [appIcon])

  // Check whether the file is valid
  const isValidFile = (file) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    const maxSize = 5 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      alert('Only PNG, JPG and WEBP files are allowed.')
      return false
    }

    if (file.size > maxSize) {
      alert('File size must not exceed 5MB.')
      return false
    }

    return true
  }

  // Handle app icon selection
  const handleIconChange = (event) => {
    const file = event.target.files[0]

    if (file && isValidFile(file)) {
      setAppIcon(file)
      updateAppDetails('appIcon', file)
    }

    event.target.value = ''
  }

  // Handle screenshot selection
  const handleScreenshotsChange = (event) => {
    const selectedFiles = Array.from(event.target.files)
    const validFiles = selectedFiles.filter(isValidFile)

    if (screenshots.length + validFiles.length > 8) {
      alert('You can upload a maximum of 8 screenshots.')
      event.target.value = ''
      return
    }

    const updatedScreenshots = [...screenshots, ...validFiles]

    setScreenshots(updatedScreenshots)
    updateAppDetails('screenshots', updatedScreenshots)

    event.target.value = ''
  }

  // Handle drag and drop
  const handleIconDrop = (event) => {
    event.preventDefault()

    const file = event.dataTransfer.files[0]

    if (file && isValidFile(file)) {
      setAppIcon(file)
      updateAppDetails('appIcon', file)
    }
  }

  const handleScreenshotsDrop = (event) => {
    event.preventDefault()

    const droppedFiles = Array.from(event.dataTransfer.files)
    const validFiles = droppedFiles.filter(isValidFile)

    if (screenshots.length + validFiles.length > 8) {
      alert('You can upload a maximum of 8 screenshots.')
      return
    }

    const updatedScreenshots = [...screenshots, ...validFiles]

    setScreenshots(updatedScreenshots)
    updateAppDetails('screenshots', updatedScreenshots)
  }

  const handleNext = (event) => {
    event.preventDefault()

    if (!appIcon) {
      alert('Please upload an app icon.')
      return
    }

    if (screenshots.length === 0) {
      alert('Please upload at least one screenshot.')
      return
    }

    onSave({
      appIcon,
      screenshots
    })

    onNext()
  }

  const handleSaveDraft = () => {
    alert('App details draft saved successfully!')
  }

  const basicInfoCompleted =
  basicInfo.contentTitle &&
  basicInfo.category &&
  basicInfo.language &&
  basicInfo.contentSource &&
  basicInfo.description

  return (
    <>
      <section className="page-header" id="application-details">
        <h1>Application Details</h1>
        <p>Upload your application assets for AI-powered screening.</p>
      </section>

      <div className="progress-container">
        <div className="step completed">
          <div className="step-circle">1</div>
          <div className="step-text">
            <h4>Basic Information</h4>
            <p>Enter content details</p>
          </div>
        </div>

        <div className="progress-line"></div>

        <div className="step active">
          <div className="step-circle">2</div>
          <div className="step-text">
            <h4>App Details</h4>
            <p>Upload application assets</p>
          </div>
        </div>

        <div className="progress-line"></div>

        <div className="step">
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

      <form className="content-area" onSubmit={handleNext}>
        <div className="form-section">
          <div className="form-card">
            <div className="card-header">
              <h2>App Details</h2>
              <p>Provide application assets for AI screening.</p>
            </div>

            <div className="upload-container">
              <div className="form-group">
                <label>1. App Icon *</label>

                <div
                  className="upload-box"
                  id="appIconBox"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleIconDrop}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <h3>Drag &amp; Drop your app icon here</h3>
                  <p>or</p>

                  <input
                    ref={iconInputRef}
                    type="file"
                    id="appIcon"
                    accept=".png,.jpg,.jpeg,.webp"
                    hidden
                    onChange={handleIconChange}
                  />

                  <button
                    type="button"
                    className="upload-btn"
                    onClick={() => iconInputRef.current.click()}
                  >
                    Choose File
                  </button>

                  {iconPreview && (
                    <img
                      src={iconPreview}
                      alt="App icon preview"
                      className="image-preview"
                    />
                  )}

                  <span id="fileName">
                    {appIcon ? appIcon.name : 'No file selected'}
                  </span>

                  <p>PNG, JPG, WEBP • Max 5MB</p>
                </div>
              </div>

              <div className="form-group">
                <label>2. App Screenshots *</label>

                <div
                  className="upload-box screenshot-box"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleScreenshotsDrop}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <h3>Drag &amp; Drop screenshots here</h3>
                  <p>or</p>

                  <input
                    ref={screenshotsInputRef}
                    type="file"
                    id="screenshots"
                    accept=".png,.jpg,.jpeg,.webp"
                    multiple
                    hidden
                    onChange={handleScreenshotsChange}
                  />

                  <button
                    type="button"
                    className="upload-btn"
                    onClick={() => screenshotsInputRef.current.click()}
                  >
                    Choose Files
                  </button>

                  <span id="countText">
                    {screenshots.length} / 8 screenshots uploaded
                  </span>

                  <p>
                    Formats: PNG, JPG, WEBP | Max size per file: 5MB
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-buttons">
            <button
              type="button"
              className="previous-btn"
              onClick={onPrevious}
            >
              Previous
            </button>

            <button
              type="button"
              className="draft-btn"
              onClick={handleSaveDraft}
            >
              Save Draft
            </button>

            <button type="submit" className="next-btn">
              Next
            </button>
          </div>
        </div>

        <aside className="info-section">
          <div className="info-card checklist">
            <h3>Submission Checklist</h3>

            <ul>
               <li>
  Basic Information - {basicInfoCompleted ? 'Completed' : 'Incomplete'}
</li>
<li>2. App Details - In Progress</li>
              <li>3. Review Your Submission</li>
              <li>4. Submit For Screening</li>
            </ul>
          </div>
        </aside>
      </form>
    </>
  )
}

export default AppDetails
