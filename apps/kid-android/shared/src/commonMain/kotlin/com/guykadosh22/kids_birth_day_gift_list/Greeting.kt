package com.guykadosh22.kids_birth_day_gift_list

class Greeting {
    private val platform = getPlatform()

    fun greet(): String {
        return sayHello(platform.name)
    }
}