import { useState, useEffect } from 'react';

export default function LogoUploader() {
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem('company_logo');
    if (savedLogo) setLogo(savedLogo);
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {

        localStorage.setItem('company_logo', reader.result);
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ marginRight: '15px' }}>
      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        { }
        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

        {logo ? (
          <img
            src={logo}
            alt="Logo Empresa"
            title="Clique para alterar a logo"
            style={{ height: '40px', maxWidth: '120px', objectFit: 'contain' }}
          />
        ) : (

          <div style={{
            height: '40px', width: '40px',
            background: '#333', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem', color: '#888', border: '1px dashed #666'
          }}>
            LOGO
          </div>
        )}
      </label>
    </div>
  );
}
