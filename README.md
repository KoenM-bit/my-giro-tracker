# 📊 DeGiro Portfolio Tracker

A comprehensive web application for tracking and analyzing your DeGiro trading portfolio performance. Upload your transaction history and account activities to get detailed insights into your investments, including real-time profit/loss analysis, performance charts, and dividend tracking.

## ✨ Features

### 📈 Portfolio Analytics
- **Real-time P&L Tracking**: Separate analysis for stocks and options with realized/unrealized gains
- **Performance Charts**: Interactive charts showing portfolio value over time with multiple timeframes
- **Holdings Analysis**: Detailed breakdown of current positions with profit/loss calculations
- **Scenario Analysis**: Analyze potential outcomes and risk scenarios

### 📋 Transaction Management
- **CSV Import**: Easy upload of DeGiro transaction history and account activity files
- **Transaction Table**: Searchable and filterable transaction history
- **Cost Analysis**: Track transaction costs and fees
- **Position Tracking**: Monitor opening and closing of positions

### 💰 Financial Tracking
- **Dividend Manager**: Track dividend payments with custom entries
- **Margin Tracking**: Monitor borrowed amounts and leverage
- **Monthly/Yearly Returns**: Calculate and visualize returns over different periods
- **YTD Performance**: Year-to-date performance analysis

### 🎛️ Advanced Features
- **User Authentication**: Secure login with Supabase authentication
- **Data Persistence**: Store portfolio snapshots and historical data
- **Real-time Price Integration**: Fetch current stock and option prices
- **Multiple Timeframes**: View data across 1M, 3M, 1Y, and ALL time periods
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🚀 Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Charts**: Recharts for data visualization
- **Build Tool**: Vite for fast development and building
- **Backend**: Supabase for authentication and data storage
- **Data Processing**: Papa Parse for CSV file handling
- **Date Handling**: date-fns for date manipulations
- **Routing**: React Router for navigation

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager

### Local Development

1. **Clone the repository**
```sh
git clone https://github.com/KoenM-bit/my-giro-tracker.git
cd my-giro-tracker
```

2. **Install dependencies**
```sh
npm install
```

3. **Environment Setup**
Create a `.env` file from the template:
```sh
cp .env.example .env
```
Then edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_PROJECT_ID="your_project_id_here"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key_here"
VITE_SUPABASE_URL="https://your_project_id.supabase.co"
```

4. **Start development server**
```sh
npm run dev
```

5. **Open in browser**
Navigate to `http://localhost:5173`

### Production Build
```sh
npm run build
npm run preview
```

## 📥 Data Import

### Supported File Formats
- **Transaction History**: DeGiro CSV export files
- **Account Activities**: DeGiro account activity CSV files

### How to Export from DeGiro
1. Log into your DeGiro account
2. Navigate to "Rapportage" (Reports)
3. Select "Transacties" (Transactions) for transaction history
4. Select "Rekeningoverzicht" (Account Overview) for account activities
5. Choose date range and export as CSV
6. Upload both files to the application

## 🎯 Key Components

### Portfolio Overview
- Total portfolio value and costs
- Separate P&L for stocks and options
- Realized vs unrealized gains/losses
- Transaction count and borrowing information

### Interactive Charts
- Portfolio value over time
- Realized P&L tracking
- Monthly and yearly return analysis
- YTD performance metrics

### Holdings Table
- Current positions with live P&L
- Average cost basis calculation
- Profit/loss percentages
- Position sizing information

### Dividend Tracking
- Manual dividend entry
- Historical dividend payments
- Total dividend income calculation

## 🔐 Security & Privacy

- Secure authentication with Supabase
- User data isolation and protection
- No financial account credentials required
- Local CSV processing (files not stored on servers)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Issues & Support

If you encounter any issues or have questions, please file an issue on the [GitHub Issues](https://github.com/KoenM-bit/my-giro-tracker/issues) page.

## 🙏 Acknowledgments

- Built with [Lovable](https://lovable.dev) platform
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Charts powered by [Recharts](https://recharts.org/)
- Backend infrastructure by [Supabase](https://supabase.com/)
