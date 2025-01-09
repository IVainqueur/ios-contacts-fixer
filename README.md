# Rwandan Contact Number Fixer

A React Native mobile app that helps you maintain consistent phone number formats for your Rwandan contacts. The app ensures each contact has both versions of their phone numbers: with and without the country code (e.g., "0788123456" and "+250788123456"), So that when an already existing contact calls you, the phone number is recognized.

## Features

- 📱 Automatically detects Rwandan phone numbers in your contacts
- 🔄 Adds missing number formats while preserving the original
- ✨ Clean and intuitive user interface
- 🔍 Search functionality to find specific contacts
- ✅ Bulk selection and fixing of multiple contacts
- 🏷️ Smart label management with prime notation (e.g., mobile, mobile', mobile'')

## How It Works

1. The app scans your contacts for Rwandan numbers (starting with "07" or "+2507")
2. It identifies contacts that don't have both versions of their numbers
3. You can fix contacts individually or select multiple for bulk fixing
4. The app maintains proper labels by adding prime marks (') to distinguish between versions

## Usage

1. Launch the app and grant contacts permission
2. Browse the list of contacts that need fixing
3. Either:
   - Tap "Fix Contact" on individual contacts
   - Select multiple contacts and use "Fix Selected Contacts"
4. Pull to refresh the list after making changes

## Technical Details

- Built with React Native and Expo
- Uses the `expo-contacts` API for contact management
- Implements safe area handling for modern devices
- Supports both light and dark themes

## Requirements

- iOS or Android device
- Contacts permission
- Expo Go app (for development)

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npx expo start`

## Privacy

The app only reads and modifies phone numbers in your contacts. No data is collected or transmitted outside your device. 