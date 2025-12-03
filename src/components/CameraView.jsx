export function CameraView() {
  return (
    <div style={{ 
      background: '#000', 
      borderRadius: '8px', 
      border: '1px solid #333', 
      height: '200px', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Simulação de "Sem Sinal" */}
      <div style={{ 
         width: '100%', height: '100%', 
         background: 'repeating-linear-gradient(45deg, #111, #111 10px, #1a1a1a 10px, #1a1a1a 20px)',
         opacity: 0.5,
         position: 'absolute'
      }} />
      
      <div style={{ zIndex: 2, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📷</div>
        <div style={{ color: '#666', fontSize: '0.8rem', fontWeight: 'bold' }}>NO SIGNAL</div>
        <div style={{ color: '#444', fontSize: '0.6rem' }}>/camera/compressed</div>
      </div>

      <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 2, background:'red', width: 8, height: 8, borderRadius:'50%' }}></div>
    </div>
  );
}