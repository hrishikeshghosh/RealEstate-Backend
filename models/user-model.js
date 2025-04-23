const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    match: [/.+@.+\..+/, 'Please enter a valid email address'] 
  },
  contactNumber: { 
    type: String, 
    required: true, 
    validate: {
      validator: function(value) {
        // Check if the value is exactly 10 digits
        return /^\d{10}$/.test(value) || (value.length >= 9 && value.length <= 15);
      },
      message: 'Please enter a valid 10-digit mobile number or a number between 9 and 15 digits'
    }
  },
  message: { 
    type: String, 
    default: "I am interested in buying some properties"
  },
  propertyType: {
    type: String,
    enum: ['Apartment', 'Townhouse', 'Villa', 'Plot', 'Full Floor'],
    // required: true
  },
  propertyArea: {
    type: String,
    // required: true
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;