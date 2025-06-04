---
marp: true
theme: default
paginate: true
style: |
  section {
    font-size: 1.5em;
  }
  h1 {
    font-size: 1.8em;
  }
  h2 {
    font-size: 1.6em;
  }
  ul {
    margin-left: 1em;
  }
  li {
    margin: 0.5em 0;
  }
---

# Square Order Generator
## Fix It Week Presentation

---

# Problem Statement

- Previously used Square Milo for cloning
- Current solution is broken and has limitations
- Need a more reliable and flexible solution

---

# Brief Description

A Node.js application that generates test data in Square:
- Creates and manages multiple locations
- Handles catalog items with images
- Generates orders with payments
- Provides cleanup functionality
- Supports multiple API tokens

---

# Functionality

## 1. Location Management
- Create multiple locations (up to 300)
- Delete/cleanup locations
- Location status management

## 2. Catalog Management
- Import catalog items with images
- Generate numbered images
- Catalog cleanup capabilities

## 3. Orders & Payments
- Generate orders with random quantities
- Process payments
- Support for concurrent order processing
- Tax management

---

# Additional Functionality

## Workday Simulation Script
- Simulates a complete business day
- Configurable parameters:
  - Order quantities
  - Concurrency levels
  - Multiple token support
- Performance optimized

---

# Terminal UI (TUI)

Interactive interface for running scripts:
- Easy script selection
- Parameter configuration
- Help documentation
- Real-time output
- Environment variable support

---

# Conclusion & Links

- GitHub Repository: [Square Order Generator](https://github.com/yourusername/square-order-generator)
- Square Developer Portal: [Square API Documentation](https://developer.squareup.com)
- Project Documentation: See README.md for detailed usage

---

# Thank You!

Questions? 