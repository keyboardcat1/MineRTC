package io.github.keyboardcat1.minertc.command;

import io.github.keyboardcat1.minertc.MineRTC;
import io.github.keyboardcat1.minertc.TokenManager;
import io.github.keyboardcat1.minertc.web.AppServer;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/**
 * A command to provide the player with a connection link and to register the player with a randomized token
 */
public class ConnectCommand implements CommandExecutor {
    private static final SecureRandom secureRandom = new SecureRandom();
    private static final Base64.Encoder base64Encoder = Base64.getUrlEncoder();

    @Override
    public boolean onCommand(CommandSender sender,Command cmd, String label, String[] args) {
        if (sender instanceof Player player) {

            UUID uuid = player.getUniqueId();

            byte[] randomBytes = new byte[18];
            secureRandom.nextBytes(randomBytes);
            String token = base64Encoder.encodeToString(randomBytes);
            String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
            String url = AppServer.getURL() + "/?u=" + uuid + "&t=" + encodedToken;

            String connectMessage = MineRTC.getInstance().getConfig().getString("connect-message");
            String jsonMessage = "[\""+connectMessage+" \", " +
                    "{\"text\":\"[Connect]\", \"clickEvent\": {\"action\":\"open_url\", \"value\":\""+url+"\"}, " +
                    "\"hoverEvent\": {\"action\": \"show_text\", \"contents\": \"Connect\"}, \"color\":\"blue\"}]";

            Bukkit.getServer().dispatchCommand(Bukkit.getConsoleSender(),
                    "tellraw " + player.getName() + " " + jsonMessage);
            TokenManager.register(uuid, token);

            AppServer.closeWSSessionsFor(uuid, 1008, "Re-issued \"/connect\".");
        }

        return true;
    }
}
