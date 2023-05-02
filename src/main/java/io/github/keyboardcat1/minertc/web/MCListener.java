package io.github.keyboardcat1.minertc.web;

import io.github.keyboardcat1.minertc.TokenManager;
import org.bukkit.Bukkit;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.WebSocketListener;

import java.util.HashMap;
import java.util.Objects;
import java.util.UUID;

public class MCListener implements WebSocketListener {
    private UUID uuid;
    public static HashMap<UUID, Session> sessions = new HashMap<>();

    public void onWebSocketConnect(Session session) {
        uuid = UUID.fromString(session.getUpgradeRequest().getParameterMap().get("u").get(0));

        //allow a player to only be connected once
        if (sessions.get(uuid) !=null)
            sessions.get(uuid).close();
        sessions.remove(uuid);

        String token = session.getUpgradeRequest().getParameterMap().get("t").get(0);

        if (TokenManager.login(uuid, token) && Objects.requireNonNull(Bukkit.getPlayer(uuid)).isOnline()) {
            sessions.put(uuid, session);
        } else {
            session.close();
        }

    }

    public void onWebSocketClose(int statusCode, String reason) {
        sessions.remove(uuid);
    }
}
