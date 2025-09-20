<template>
  <div class="home">
    <div class="hero">
      <h1>XRPL Medical Records Platform</h1>
      <p>Securely share autism evaluations between patients and hospitals using blockchain technology</p>

      <div class="portal-buttons">
        <router-link to="/patient" class="portal-button patient-button">
          <div class="button-icon">👤</div>
          <div class="button-content">
            <h3>Patient Portal</h3>
            <p>Upload your evaluation files securely</p>
            <span class="price">Free</span>
          </div>
        </router-link>

        <router-link to="/hospital" class="portal-button hospital-button">
          <div class="button-icon">🏥</div>
          <div class="button-content">
            <h3>Hospital Portal</h3>
            <p>Access patient evaluations</p>
            <span class="price">$15 per access</span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.hero {
  padding: 4rem 2rem;
  text-align: center;
  max-width: 1200px;
  margin: 0 auto;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.hero p {
  font-size: 1.2rem;
  margin-bottom: 3rem;
  opacity: 0.9;
}

.portal-buttons {
  display: flex;
  gap: 2rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 4rem;
}

.portal-button {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  padding: 2rem;
  text-decoration: none;
  color: white;
  transition: all 0.3s ease;
  min-width: 300px;
}

.portal-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-5px);
}

.button-icon {
  font-size: 3rem;
}

.button-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.button-content p {
  margin: 0 0 0.5rem 0;
  opacity: 0.8;
}

.price {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.3rem 0.8rem;
  border-radius: 1rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.features {
  background: rgba(255, 255, 255, 0.1);
  padding: 4rem 2rem;
  margin-top: 2rem;
}

.features h2 {
  text-align: center;
  margin-bottom: 3rem;
  font-size: 2.5rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.feature {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 1rem;
  text-align: center;
}

.feature h3 {
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.feature p {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }

  .portal-buttons {
    flex-direction: column;
    align-items: center;
  }

  .portal-button {
    min-width: 280px;
  }
}
</style>