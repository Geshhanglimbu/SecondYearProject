// Frontend: React.js implementation of the Waste Management Request page
// App.js - Main entry point
// Run with: npx create-react-app eco-cycle && cd eco-cycle && npm install react-bootstrap && npm start
// Then replace src/App.js with this, and add App.css

import React, { useState } from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Row, Col, Form, Button, Card } from 'react-bootstrap';

function App() {
  const [selectedRequest, setSelectedRequest] = useState('bin-replacement');
  const [description, setDescription] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate backend submission (in real app, use axios to POST to backend)
    console.log({
      type: selectedRequest,
      description,
      pickupDate,
      pickupTime,
      file
    });
    alert('Request submitted!'); // Replace with actual API call
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">EcoConnect</div>
        <div className="user">Hello Isha <img src="avatar-placeholder.png" alt="avatar" className="avatar" /></div>
      </header>
      <Container fluid>
        <Row>
          <Col md={2} className="sidebar">
            <ul>
              <li>Dashboard</li>
              <li className="active">+ New Request</li>
              <li>Complaints</li>
              <li>Schedule</li>
            </ul>
          </Col>
          <Col md={10} className="main-content">
            <h2>Your request</h2>
            <Row className="request-types">
              <Col md={4}>
                <Card className="request-card">
                  <Card.Body>
                    <div className="icon">♻️</div>
                    <h5>Recycling Pickup</h5>
                    <p>Schedule a pickup for your recyclable items.</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="request-card selected">
                  <Card.Body>
                    <div className="icon">🗑️</div>
                    <h5>Bin Replacement</h5>
                    <p>Request a new or replacement waste bin.</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="request-card">
                  <Card.Body>
                    <div className="icon">🌿</div>
                    <h5>Bulk Waste</h5>
                    <p>Arrange pickup for large non-hazardous items.</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <Row>
              <Col md={6} className="illustration">
                <img src="polar-bear-illustration.png" alt="Polar bear on ice" className="polar-bear" />
              </Col>
              <Col md={6}>
                <Form onSubmit={handleSubmit}>
                  <Form.Group>
                    <Form.Label>Upload Image (optional)</Form.Label>
                    <Form.Control type="file" onChange={(e) => setFile(e.target.files[0])} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Describe the Issue</Form.Label>
                    <Form.Control as="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Please provide details about your request..." />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Pickup Date</Form.Label>
                    <Form.Control type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Pickup Time</Form.Label>
                    <Form.Control type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                  </Form.Group>
                  <Button variant="success" type="submit" className="submit-btn">Submit</Button>
                </Form>
              </Col>
            </Row>
            <div className="quote">
              "The easiest waste to manage is the waste we never create."
            </div>
          </Col>
        </Row>
      </Container>
      <footer className="footer">
        <div className="footer-logo">EcoConnect</div>
        <div className="quick-links">
          <h6>Quick Links</h6>
          <ul>
            <li>Dashboard</li>
            <li>New Request</li>
            <li>Complaints</li>
            <li>About Us</li>
            <li>Privacy Policy</li>
            <li>Terms of Service</li>
          </ul>
        </div>
        <div className="connect">
          <h6>Connect</h6>
          <ul>
            <li>Twitter</li>
            <li>Facebook</li>
            <li>Instagram</li>
            <li>info@ecoconnect.com</li>
          </ul>
        </div>
        <p>© 2025 EcoConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;