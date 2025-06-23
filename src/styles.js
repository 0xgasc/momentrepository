// Shared styles for Concert Moments Platform

export const styles = {
  // Form inputs
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: '#f9fafb'
  },
  
  inputReadonly: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: '#f5f5f5',
    color: '#666'
  },
  
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: '#f9fafb',
    minHeight: '80px'
  },
  
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '600',
    color: '#374151',
    fontSize: '0.875rem'
  },
  
  // Modal styles
  modal: {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    },
    
    content: {
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      border: '2px solid #3b82f6',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto'
    },
    
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem'
    },
    
    title: {
      marginBottom: '0.5rem',
      fontSize: '1.5rem',
      fontWeight: 'bold'
    },
    
    subtitle: {
      color: '#666',
      fontSize: '1rem'
    }
  },
  
  // Buttons
   button: {
    primary: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '0.875rem 1.5rem', // CHANGED: Larger padding
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      minHeight: '44px', // ADDED: iOS minimum
      touchAction: 'manipulation' // ADDED: Prevent double-tap zoom
    },
    
    secondary: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '0.875rem 1.5rem', // CHANGED: Larger padding
      cursor: 'pointer',
      fontSize: '1rem',
      minHeight: '44px', // ADDED: iOS minimum
      touchAction: 'manipulation' // ADDED
    },
    
    small: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '0.5rem 1rem', // CHANGED: Larger padding
      cursor: 'pointer',
      fontSize: '0.875rem',
      minHeight: '36px', // ADDED: Smaller but still touch-friendly
      touchAction: 'manipulation' // ADDED
    }
  },
  // Section styles
  section: {
    container: {
      marginBottom: '1.5rem'
    },
    
    title: {
      fontSize: '1.1rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      color: '#1f2937'
    },
    
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem',
      marginBottom: '1rem'
    }
  },
  
  // File upload
  fileUpload: {
    container: {
      border: '2px dashed #d1d5db',
      borderRadius: '8px',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#f9fafb'
    },
    
    icon: {
      fontSize: '3rem',
      marginBottom: '1rem'
    },
    
    text: {
      marginBottom: '0.5rem'
    },
    
    subtext: {
      fontSize: '0.875rem',
      color: '#6b7280'
    }
  },
  
  // Error and success messages
  message: {
    error: {
      backgroundColor: '#fee2e2',
      color: '#dc2626',
      padding: '1rem',
      borderRadius: '6px',
      marginBottom: '1rem'
    },
    
    success: {
      backgroundColor: '#d1fae5',
      color: '#059669',
      padding: '1rem',
      borderRadius: '6px',
      marginBottom: '1rem'
    }
  },
  
  // NFT ready badge
  nftBadge: {
    container: {
      marginTop: '1.5rem',
      padding: '1rem',
      backgroundColor: '#d1fae5',
      border: '1px solid #10b981',
      borderRadius: '8px'
    },
    
    content: {
      display: 'flex',
      alignItems: 'center'
    },
    
    dot: {
      width: '12px',
      height: '12px',
      backgroundColor: '#10b981',
      borderRadius: '50%',
      marginRight: '0.75rem'
    },
    
    title: {
      fontWeight: '600',
      color: '#065f46'
    },
    
    text: {
      color: '#047857',
      fontSize: '0.875rem'
    }
  },
  
  // Media display
  mediaDisplay: {
    container: {
      border: '2px solid #d1d5db',
      borderRadius: '8px',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#f9fafb'
    },
    
    fileName: {
      fontWeight: 'bold',
      marginBottom: '0.5rem'
    },
    
    fileInfo: {
      color: '#6b7280',
      marginBottom: '1rem'
    },
    
    warning: {
      fontSize: '0.75rem',
      color: '#6b7280',
      marginTop: '0.5rem'
    }
  },
  
  // Footer actions
  footerActions: {
    container: {
      borderTop: '1px solid #e5e7eb',
      paddingTop: '1.5rem',
      display: 'flex',
      gap: '1rem',
      justifyContent: 'flex-end'
    }
  }
};

export const mobileOptimizedStyles = {
  // Update your existing modal styles with these:
  modal: {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'flex-start', // CHANGED: Was 'center'
      justifyContent: 'center',
      padding: '1rem',
      overflowY: 'auto' // ADDED: Allows scrolling
    },
    
    content: {
      backgroundColor: 'white',
      padding: window.innerWidth <= 640 ? '1.5rem' : '2rem', // CHANGED: Less padding on mobile
      borderRadius: window.innerWidth <= 640 ? '0' : '12px', // CHANGED: No radius on mobile
      border: '2px solid #3b82f6',
      maxWidth: '700px',
      width: window.innerWidth <= 640 ? '100%' : '95%', // CHANGED: Full width on mobile
      maxHeight: window.innerWidth <= 640 ? '100vh' : '90vh', // CHANGED: Full height on mobile
      overflow: 'auto',
      margin: window.innerWidth <= 640 ? '0' : '20px auto' // ADDED: No margin on mobile
    }
  },}