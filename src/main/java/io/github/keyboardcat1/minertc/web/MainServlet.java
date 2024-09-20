package io.github.keyboardcat1.minertc.web;

import io.github.keyboardcat1.minertc.audio.AudioProcessingDataGenerator;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.simple.JSONObject;

import java.io.IOException;
import java.io.InputStream;

/**
 * A servlet which serves main.html
 */
class MainServlet extends HttpServlet {
    @Override
    public void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String path = req.getPathInfo();
        if (path.equals("/")) {
            InputStream is = this.getClass().getClassLoader().getResourceAsStream("web/main.html");
            res.setContentType("text/html");
            assert is != null;
            is.transferTo(res.getOutputStream());
        } else if (path.equals("/config.js")) {
            res.setContentType("text/javascript");
            res.getWriter().print("const SERVER_CONFIG = " + constructConfigJSON() + ";");
        } else {
            res.sendError(404);
        }
    }

    private static String constructConfigJSON() {
        JSONObject out = new JSONObject();
        out.put("maxDistance", AudioProcessingDataGenerator.MAX_VOICE_DISTANCE);
        return out.toString();
    }
}
