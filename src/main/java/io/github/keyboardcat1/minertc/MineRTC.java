package io.github.keyboardcat1.minertc;

import io.github.keyboardcat1.minertc.command.ConnectCommand;
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
import java.util.UUID;

import static io.github.keyboardcat1.minertc.audio.AudioProcessingDataGenerator.playerToAudioProcessingData;

public class MineRTC extends JavaPlugin implements Listener {


    public static final int PORT = 443;
    public static final String IP = "intpstuff.ddns.net";
    public static final String URL = "https://" + IP + (PORT==443 ? "" : ":" + PORT);

    private static MineRTC instance;

    @SuppressWarnings("unused")
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

        // commands
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
        UUID uuid = event.getPlayer().getUniqueId();

        if (MCListener.sessions.get(uuid) != null) {
            MCListener.sessions.get(uuid).close();
            MCListener.sessions.remove(uuid);
        }

        if (RTCListener.sessions.get(uuid) != null) {
            RTCListener.sessions.get(uuid).close();
            RTCListener.sessions.remove(uuid);
        }
    }


    private void broadcastAudioProcessingData() {
        // send AudioProcessingData to every player connected to /ws/mc
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


}