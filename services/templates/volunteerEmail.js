class VolunteerEmailTemplate {
  static generateHTML(volunteerData) {
    const getAvailabilityText = (availability) => {
      const availabilities = {
        'weekdays': 'Weekdays only',
        'weekends': 'Weekends only',
        'both': 'Both weekdays and weekends',
        'flexible': 'Flexible schedule'
      };
      return availabilities[availability] || availability;
    };

    const getInterestText = (interests) => {
      const interestMap = {
        'music-education': 'Music Education',
        'instrument-repair': 'Instrument Repair',
        'donation-pickup': 'Donation Pickup',
        'events': 'Events',
        'administration': 'Administration',
        'other': 'Other'
      };
      return interests.map(interest => interestMap[interest] || interest).join(', ');
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Volunteer Application</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f5ee; 
          }
          .container { 
            max-width: 800px; 
            background-color: #ffffff;
            margin: 20px auto; 
            border: 1px solid #9ba5a5;
            background: white; 
            border-radius: 8px;
            overflow: hidden; 
          }
          .header { 
            background: white; 
            padding: 30px; 
            text-align: center; 
            border-bottom: 1px solid #9ba5a5; 
            width: 100%;
          }
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
          }
          .logo-image {
            width: 250px;
            height: 180px;
            margin: auto;
          }
          .content { 
            padding: 30px; 
            background: white; 
          }
          .volunteer-title { 
            color: #2d3748; 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            line-height: 1.3; 
            text-align: center;
          }
          .volunteer-subtitle { 
            color: #666; 
            font-size: 16px; 
            text-align: center; 
            margin-bottom: 25px; 
          }
          .volunteer-details { 
            margin-bottom: 25px; 
          }
          .section { 
            margin-bottom: 25px; 
          }
          .section-title { 
            font-size: 18px; 
            font-weight: bold; 
            color: #333; 
            margin-bottom: 15px; 
          }
          .detail-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 12px; 
            padding-bottom: 8px; 
          }
          .detail-row:last-child { 
            margin-bottom: 0; 
          }
          .detail-label { 
            font-weight: bold; 
            color: #333; 
            min-width: 120px; 
          }
          .detail-value { 
            color: #333; 
            text-align: right; 
            flex: 1; 
          }
          .experience-box { 
            margin: 15px 0; 
            color: #333;
          }
          .motivation-box { 
            margin: 15px 0; 
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony 4 All Logo" class="logo-image">            
            </div>
          </div>
          
          <div class="content">
            <h1 class="volunteer-title">New Volunteer Application!</h1>
            <div class="volunteer-subtitle">Someone wants to volunteer with Harmony 4 All</div>
            
            <div class="volunteer-details">
              <div class="section">
                <div class="section-title">Personal Information</div>
                <div class="detail-row">
                  <span class="detail-label">Full Name:</span>
                  <span class="detail-value">${volunteerData.firstName} ${volunteerData.lastName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${volunteerData.email}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${volunteerData.phone}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date of Birth:</span>
                  <span class="detail-value">${formatDate(volunteerData.dateOfBirth)}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Address Information</div>
                ${volunteerData.address ? `
                <div class="detail-row">
                  <span class="detail-label">Street:</span>
                  <span class="detail-value">${volunteerData.address.street || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">City:</span>
                  <span class="detail-value">${volunteerData.address.city || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">State:</span>
                  <span class="detail-value">${volunteerData.address.state || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">ZIP Code:</span>
                  <span class="detail-value">${volunteerData.address.zipCode || 'Not provided'}</span>
                </div>
                ` : '<div class="detail-row"><span class="detail-value">No address provided</span></div>'}
              </div>

              <div class="section">
                <div class="section-title">Emergency Contact</div>
                ${volunteerData.emergencyContact ? `
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${volunteerData.emergencyContact.name || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Relationship:</span>
                  <span class="detail-value">${volunteerData.emergencyContact.relationship || 'Not provided'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${volunteerData.emergencyContact.phone || 'Not provided'}</span>
                </div>
                ` : '<div class="detail-row"><span class="detail-value">No emergency contact provided</span></div>'}
              </div>

              <div class="section">
                <div class="section-title">Volunteer Preferences</div>
                <div class="detail-row">
                  <span class="detail-label">Availability:</span>
                  <span class="detail-value">${getAvailabilityText(volunteerData.availability)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Interests:</span>
                  <span class="detail-value">${getInterestText(volunteerData.interests || [])}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Experience & Motivation</div>
                <div class="experience-box">
                  <strong>Experience:</strong><br>
                  ${volunteerData.experience}
                </div>
                <div class="motivation-box">
                  <strong>Motivation:</strong><br>
                  ${volunteerData.motivation}
                </div>
              </div>

              <div class="section">
                <div class="section-title">Application Details</div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value">Pending Review</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Submitted At:</span>
                  <span class="detail-value">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(volunteerData) {
    const getAvailabilityText = (availability) => {
      const availabilities = {
        'weekdays': 'Weekdays only',
        'weekends': 'Weekends only',
        'both': 'Both weekdays and weekends',
        'flexible': 'Flexible schedule'
      };
      return availabilities[availability] || availability;
    };

    const getInterestText = (interests) => {
      const interestMap = {
        'music-education': 'Music Education',
        'instrument-repair': 'Instrument Repair',
        'donation-pickup': 'Donation Pickup',
        'events': 'Events',
        'administration': 'Administration',
        'other': 'Other'
      };
      return interests.map(interest => interestMap[interest] || interest).join(', ');
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    };

    return `
New Volunteer Application!

Someone wants to volunteer with Harmony 4 All.

PERSONAL INFORMATION:
Full Name: ${volunteerData.firstName} ${volunteerData.lastName}
Email: ${volunteerData.email}
Phone: ${volunteerData.phone}
Date of Birth: ${formatDate(volunteerData.dateOfBirth)}

ADDRESS INFORMATION:
${volunteerData.address ? `
Street: ${volunteerData.address.street || 'Not provided'}
City: ${volunteerData.address.city || 'Not provided'}
State: ${volunteerData.address.state || 'Not provided'}
ZIP Code: ${volunteerData.address.zipCode || 'Not provided'}
` : 'No address provided'}

EMERGENCY CONTACT:
${volunteerData.emergencyContact ? `
Name: ${volunteerData.emergencyContact.name || 'Not provided'}
Relationship: ${volunteerData.emergencyContact.relationship || 'Not provided'}
Phone: ${volunteerData.emergencyContact.phone || 'Not provided'}
` : 'No emergency contact provided'}

VOLUNTEER PREFERENCES:
Availability: ${getAvailabilityText(volunteerData.availability)}
Interests: ${getInterestText(volunteerData.interests || [])}

EXPERIENCE & MOTIVATION:
Experience: ${volunteerData.experience}

Motivation: ${volunteerData.motivation}

APPLICATION DETAILS:
Status: Pending Review
Submitted At: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}

---
This notification was sent from your Harmony 4 All volunteer application system.
    `;
  }
}

module.exports = VolunteerEmailTemplate;
