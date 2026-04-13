#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          COVENANT DEMO RECORDING SCRIPT                     ║"
echo "║  Records a demonstration of the COVENANT protocol in action  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if we have recording tools
if ! command -v ffmpeg &> /dev/null; then
    echo "Warning: ffmpeg not found. Install ffmpeg for better recording quality."
    echo "Continuing with basic terminal recording using script..."
fi

# Create recordings directory
mkdir -p recordings
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RECORDING_FILE="recordings/covenant_demo_$TIMESTAMP"

echo "Starting demo recording..."
echo "Output will be saved to: $RECORDING_FILE.log"

# Record the demo execution
{
    echo "=================================================="
    echo "COVENANT DEMO RECORDING"
    echo "Timestamp: $(date)"
    echo "=================================================="
    echo ""

    # Run the local demo (uses Hardhat node for faster, free execution)
    ./demo.sh local

    echo ""
    echo "=================================================="
    echo "DEMO RECORDING COMPLETED"
    echo "Timestamp: $(date)"
    echo "=================================================="
} 2>&1 | tee "$RECORDING_FILE.log"

echo ""
echo "Demo recording saved to: $RECORDING_FILE.log"
echo ""
echo "To create a video recording, you can use:"
echo "ffmpeg -f x11grab -r 30 -s $(xdpyinfo | grep 'dimensions:'|awk '{print $2}') -i :0.0 -f alsa -i default -c:v libx264 -c:a aac output.mp4"
echo ""
echo "Or use a screen recording tool to capture the terminal output while running:"
echo "./demo.sh local"