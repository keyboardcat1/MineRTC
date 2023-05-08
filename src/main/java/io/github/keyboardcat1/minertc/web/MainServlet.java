package io.github.keyboardcat1.minertc.web;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;

/**
 * A servlet which serves main.html
 */
class MainServlet extends HttpServlet {
    @Override
    public void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        InputStream is = this.getClass().getClassLoader().getResourceAsStream("web/main.html");
        res.setHeader("Content-Type", "text/html");

        assert is != null;

        is.transferTo(res.getOutputStream());
    }
}
