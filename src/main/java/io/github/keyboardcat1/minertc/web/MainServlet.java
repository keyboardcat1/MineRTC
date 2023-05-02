package io.github.keyboardcat1.minertc.web;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;

public class MainServlet extends HttpServlet {

    public void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        //serve resources/main.html
        InputStream is = this.getClass().getClassLoader().getResourceAsStream("main.html");
        res.setHeader("Content-Type", "text/html");

        assert is != null;

        is.transferTo(res.getOutputStream());
    }
}
