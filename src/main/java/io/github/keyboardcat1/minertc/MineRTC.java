package io.github.keyboardcat1.minertc;

import io.github.keyboardcat1.minertc.command.ConnectCommand;
import io.github.keyboardcat1.minertc.util.AudioProcessingData;
import io.github.keyboardcat1.minertc.web.AppServer;
import io.github.keyboardcat1.minertc.web.MCListener;
import io.github.keyboardcat1.minertc.web.RTCListener;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.util.Objects;

public class MineRTC extends JavaPlugin implements Listener {


    public static final int PORT = 80;
    public static final String IP = "feathertech.serveminecraft.net";
    public static final String URL = "http://" + IP + (PORT==80 ? "" : ":" + PORT);

    private static MineRTC instance;

    public static MineRTC getInstance() {
        return instance;
    }
    public void onEnable() {
        instance = this;
        Bukkit.getPluginManager().registerEvents(this, this);

        //start web server
        try {
            AppServer.main(new String[0]);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        Objects.requireNonNull(getCommand("connect")).setExecutor(new ConnectCommand());

        //broadcast audio processing data every second
        getServer().getScheduler().runTaskTimer(this, this::broadcastAudioProcessingData, 1L, 20L);
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        //disconnect player from sockets on quit
        MCListener.sessions.remove(event.getPlayer().getUniqueId());
        RTCListener.sessions.remove(event.getPlayer().getUniqueId());
    }

    protected AudioProcessingData.ChannelProcessingData playersToChannelProcessingData(Player main, Player other) {
        //calculate audio gain and pan based on other player's relative position
        double deltaX = other.getLocation().getX() - main.getLocation().getX();
        double deltaY = other.getLocation().getY() - main.getLocation().getY();
        //absolute angle
        double theta = Math.atan2(deltaY, deltaX);

        double distance = main.getLocation().distance(other.getLocation());
        //angle relative to head rotation
        double deltaTheta = theta - Math.toRadians(main.getLocation().getYaw());

        float gain = (float) (1 / (distance + 1));
        float pan = (float) Math.sin(deltaTheta);

        return new AudioProcessingData.ChannelProcessingData(gain, pan);
    }

    private void broadcastAudioProcessingData() {
        //send AudioProcessingData to each player
        MCListener.sessions.forEach((uid, session) -> {
            Player player = Bukkit.getPlayer(uid);
            try {
                assert player != null;
                session.getRemote().sendBytes(playerToAudioProcessingData(player).toBytes());
            } catch (IOException e) {
                throw new RuntimeException(e);
            }

        });
    }

    private AudioProcessingData playerToAudioProcessingData(Player player) {
        //generate ChannelProcessingData from all other players
        AudioProcessingData out = new AudioProcessingData();
        Bukkit.getOnlinePlayers().forEach((other) -> {
            int THRESHOLD = 50;
            //check that other player isn't actually this player
            if (player.equals(other)) return;
            //check that other player is connected to both websocket endpoints
            if (MCListener.sessions.get(other.getUniqueId()) == null || RTCListener.sessions.get(other.getUniqueId()) == null)  return;
            //check that other player isn't too far away
            if (player.getLocation().distance(other.getLocation()) > THRESHOLD) return;

            out.put(other.getUniqueId(), playersToChannelProcessingData(player, other));
        });
        return out;
    }
}