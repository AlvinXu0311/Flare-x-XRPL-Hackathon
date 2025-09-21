#!/bin/bash

DB_FILE="medical-vault-mappings.db"

echo "🗃️ Medical Vault Database Cleaner"
echo "================================="

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Database file not found: $DB_FILE"
    exit 1
fi

echo "Current record count: $(sqlite3 $DB_FILE 'SELECT COUNT(*) FROM document_mappings;')"
echo ""

echo "Choose an option:"
echo "1. Clear ALL records (complete reset)"
echo "2. Clear records for specific wallet"
echo "3. Clear records older than X days"
echo "4. View all records"
echo "5. Exit"

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        read -p "⚠️ Are you sure you want to delete ALL records? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            sqlite3 $DB_FILE "DELETE FROM document_mappings;"
            echo "✅ All records cleared!"
        else
            echo "❌ Operation cancelled"
        fi
        ;;
    2)
        read -p "Enter wallet address: " wallet
        sqlite3 $DB_FILE "DELETE FROM document_mappings WHERE walletAddress = '$wallet';"
        echo "✅ Records for wallet $wallet cleared!"
        ;;
    3)
        read -p "Enter number of days: " days
        sqlite3 $DB_FILE "DELETE FROM document_mappings WHERE uploadDate < datetime('now', '-$days days');"
        echo "✅ Records older than $days days cleared!"
        ;;
    4)
        echo "📋 All Records:"
        sqlite3 -header -column $DB_FILE "SELECT txHash, fileName, walletAddress, uploadDate FROM document_mappings ORDER BY uploadDate DESC;"
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        ;;
esac

echo ""
echo "Final record count: $(sqlite3 $DB_FILE 'SELECT COUNT(*) FROM document_mappings;')"