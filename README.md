# MineRTC

The easiest minecraft proximity chat plugin to use.

## Description

MineRTC allows for Vanilla clients to talk to each other through proximity chat using their browsers.
This is done through WebRTC connections and WebSockets.

## Usage
### Server
1. Place the latest jar in your plugins folder
2. Start your Bukkit based server

### In game

1. Type `/connect` and open the provided link in your browser
2. On the warning page, click on `Advanced -> proceed to [server ip]`
3. Chat with your friends!


## Building
1. Install dependencies
2. Run `./gradlew build` (Linux and MacOS) or `./gradlew.bat build` (Windows)

The plugin jar will be in `build/libs`

#### Build dependencies
- node 

## How it works

![MineRTC diagram](diagram.png "Functional diagram")




