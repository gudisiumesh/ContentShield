
import { useState, useRef, useEffect } from 'react'

function BasicInformation({ basicInfo, onNext, onSave }) {
  const [contentTitle, setContentTitle] = useState(basicInfo.contentTitle || '')
  const [category, setCategory] = useState(basicInfo.category || '')
  const [language, setLanguage] = useState(basicInfo.language || '')
  const [contentSource, setContentSource] = useState(basicInfo.contentSource || '')
  const [description, setDescription] = useState(basicInfo.description || '')
  const [appIcon, setAppIcon] = useState(basicInfo.appIcon || null)
  const [imagePreview, setImagePreview] = useState(null)

  const fileInputRef = useRef(null)

  // Update the data stored in App.jsx
  const updateBasicInfo = (field, value) => {
    onSave(previous => ({
      ...previous,
      [field]: value
    }))
  }

  // Load the local draft only when no parent data is available
  useEffect(() => {
    if (Object.keys(basicInfo).length === 0) {
      const savedDraft = localStorage.getItem('contentDraft')

      if (savedDraft) {
        const draftData = JSON.parse(savedDraft)

        setContentTitle(draftData.contentTitle || '')
        setCategory(draftData.category || '')
        setLanguage(draftData.language || '')
        setContentSource(draftData.contentSource || '')
        setDescription(draftData.description || '')
      }
    }
  }, [])

  // Create image preview when an image is selected
  useEffect(() => {
    if (!appIcon) {
      setImagePreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(appIcon)
    setImagePreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [appIcon])
const handleNext = (event) => {
  event.preventDefault()

  if (!contentTitle || !category || !language || !contentSource || !description) {
    alert('Please fill in all required fields.')
    return
  }

  const updatedBasicInfo = {
    contentTitle,
    category,
    language,
    contentSource,
    description,
    appIcon
  }

  onSave(updatedBasicInfo)
  onNext()
}
  // Clear form and saved draft
  const handleCancel = () => {
    setContentTitle('')
    setCategory('')
    setLanguage('')
    setContentSource('')
    setDescription('')
    setAppIcon(null)
    setImagePreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    onSave({})
    localStorage.removeItem('contentDraft')
  }

  // Save form details as a draft
  const handleSaveDraft = () => {
    const draftData = {
      contentTitle,
      category,
      language,
      contentSource,
      description
    }

    localStorage.setItem('contentDraft', JSON.stringify(draftData))

    alert('Draft saved successfully!')
  }

  return (
    <>
      <section className="page-header" id="basic-information">
        <h1>Submit Your Content</h1>
        <p>
          Fill in the details below to submit your content for AI-powered screening.
        </p>
      </section>

      <div className="progress-container">
        <div className="step active">
          <div className="step-circle">1</div>
          <div className="step-text">
            <h4>Basic Information</h4>
            <p>Enter content details</p>
          </div>
        </div>

        <div className="progress-line"></div>

        <div className="step">
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
              <h2>Content Information</h2>
              <p>Provide the basic information about your content.</p>
            </div>
        
<div className="form-group">
  <label>Upload Image</label>

  <div className="upload-box">
    <i className="fa-solid fa-cloud-arrow-up"></i>

    <h3>Upload Image</h3>
    <p>Upload an image related to your content.</p>

    {imagePreview && (
      <img
        className="image-preview"
        src={imagePreview}
        alt="Selected image preview"
        width="150"
      />
    )}

    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(event) => {
        const file = event.target.files[0] || null
        setAppIcon(file)
        updateBasicInfo('appIcon', file)
      }}
    />

    <button
      type="button"
      onClick={() => fileInputRef.current.click()}
    >
      Choose File
    </button>

    <span>
      {appIcon ? appIcon.name : 'No file selected'}
    </span>
  </div>
</div>


            <div className="form-group">
              <label>Content Title</label>
              <input
                type="text"
                value={contentTitle}
                onChange={(event) => {
                  const value = event.target.value
                  setContentTitle(value)
                  updateBasicInfo('contentTitle', value)
                }}
                placeholder="Enter content title"
              />
            </div>

            <div className="form-group">
              <label>Content Category</label>
              <select
                value={category}
                onChange={(event) => {
                  const value = event.target.value
                  setCategory(value)
                  updateBasicInfo('category', value)
                }}
              >
                <option value="">Select category</option>
                <option value="Image">Image</option>
                <option value="Video">Video</option>
                <option value="Audio">Audio</option>
                <option value="Document">Document</option>
                <option value="APK / Mobile App">APK / Mobile App</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Content Language</label>
              <select
                value={language}
                onChange={(event) => {
                  const value = event.target.value
                  setLanguage(value)
                  updateBasicInfo('language', value)
                }}
              >
                <option value="">Select language</option>
                <option value="English">English</option>
              </select>
            </div>

            <div className="form-group">
              <label>Content Source</label>
              <input
                type="text"
                value={contentSource}
                onChange={(event) => {
                  const value = event.target.value
                  setContentSource(value)
                  updateBasicInfo('contentSource', value)
                }}
                placeholder="Enter content source"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(event) => {
                  const value = event.target.value
                  setDescription(value)
                  updateBasicInfo('description', value)
                }}
                placeholder="Describe your content"
              />
            </div>
          </div>

          <div className="form-buttons">
            <button
              type="button"
              className="cancel-btn"
              onClick={handleCancel}
            >
              Cancel
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
          <div className="info-card">
            <h3>Screening Includes</h3>
            <ul>
              <li>Adult Content Detection</li>
              <li>Malware Scanning</li>
              <li>Fraud Detection</li>
              <li>Quality Analysis</li>
              <li>Age Classification</li>
            </ul>
          </div>

          <div className="info-card">
            <h3>Secure Data</h3>
            <p>
              Your submitted content is handled securely during the screening process.
            </p>
          </div>
        </aside>
      </form>
    </>
  )
}

export default BasicInformation
