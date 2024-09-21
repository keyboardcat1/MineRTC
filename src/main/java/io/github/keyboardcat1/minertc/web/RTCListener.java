package io.github.keyboardcat1.minertc.web;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import io.github.keyboardcat1.minertc.MineRTC;
import io.github.keyboardcat1.minertc.TokenManager;
import org.bukkit.Bukkit;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.WebSocketListener;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.UUID;

/**
 * A WebSocket endpoint acting as an WebRTC signaling server by relaying sent data to every connected session
 */
public class RTCListener implements WebSocketListener {
    private UUID uuid;
    public static final HashMap<UUID, Session> sessions = new HashMap<>();

    @Override
    public void onWebSocketConnect(Session session) {
        if (session.getUpgradeRequest().getParameterMap().get("u") == null || session.getUpgradeRequest().getParameterMap().get("t") == null)
            session.close(1008, "Unauthorized.");
        uuid = UUID.fromString(session.getUpgradeRequest().getParameterMap().get("u").get(0));
        String token = session.getUpgradeRequest().getParameterMap().get("t").get(0);

        //validate token and check that player is online
        if (Bukkit.getPlayer(uuid) != null && TokenManager.login(uuid, token)) {
            //allow a player to only be connected once
            if (sessions.get(uuid) != null) {
                sessions.get(uuid).close(1001, "Connected from another client.");
            }
            sessions.put(uuid, session);
            session.setIdleTimeout(Duration.ZERO);
        } else {
            session.close(1008, "Unauthorized.");
        }

    }

    @Override
    public void onWebSocketClose(int statusCode, String reason) {
        sessions.remove(uuid);
    }

    @Override
    public void onWebSocketText(String message) {
        try {
            JsonObject incoming = new Gson().fromJson(message, JsonObject.class);
            JsonObject outgoing = new JsonObject();

            JsonElement to = incoming.get("to");
            JsonElement data = incoming.get("data");

            System.out.println(to.getAsString());

            if (sessions.get(UUID.fromString(to.getAsString())) == null) return;

            outgoing.addProperty("from", uuid.toString());
            outgoing.add("data", data);

            sessions.get(UUID.fromString(to.getAsString())).getRemote().sendString(outgoing.toString());
        } catch (IOException e) {
            MineRTC.getInstance().getLogger().warning("WS : Could not send string");
        }
    }
}
