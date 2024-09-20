package io.github.keyboardcat1.minertc;

import io.github.keyboardcat1.minertc.command.ConnectCommand;
import io.github.keyboardcat1.minertc.web.AppServer;
import io.github.keyboardcat1.minertc.web.MCListener;
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

// TODO: Settings for threshold&gain

public class MineRTC extends JavaPlugin implements Listener {

    private static MineRTC instance;

    @SuppressWarnings("unused")
    public static MineRTC getInstance() {
        return instance;
    }

    @Override
    public void onEnable() {
        instance = this;
        Bukkit.getPluginManager().registerEvents(this, this);

        // creates a config.yml file
        saveDefaultConfig();
        reloadConfig();

        // start web server
        try {
            String address = getConfig().getString("address");
            if (Objects.equals(address, "your.address"))
                getLogger().warning("CONFIGURE YOUR SERVER ADDRESS IN CONFIG!");
            AppServer.main(new String[0]);

        } catch (Exception e) {
            getLogger().severe("Web server failed to start");
            throw new RuntimeException(e);
        }

        // commands
        Objects.requireNonNull(getCommand("connect")).setExecutor(new ConnectCommand());

        // broadcast audio processing data every second
        int interval = getConfig().getInt("update-interval");
        getServer().getScheduler().runTaskTimer(this, this::broadcastAudioProcessingData, 1L, interval);
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        //disconnect player from sockets on quit
        UUID uuid = event.getPlayer().getUniqueId();

        AppServer.closeWSSessionsFor(uuid, 1008, "Disconnected from MineCraft.");
    }


    private void broadcastAudioProcessingData() {
        // send AudioProcessingData to every player connected to /ws/mc
        MCListener.sessions.forEach((uuid, session) -> {
            Player player = Bukkit.getPlayer(uuid);
            if (player != null) {
                try {
                    session.getRemote().sendBytes(playerToAudioProcessingData(player).toBytes());
                } catch (IOException e) {
                    getLogger().severe("WS : Could not send string");
                }
            }
        });
    }
}